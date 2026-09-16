// Orbiscreen - wt_stream.rs (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

use std::io::{self, Write as _};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine as _;
use rustls::pki_types::pem::PemObject as _;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use tokio::sync::broadcast;
use tracing::{debug, info, warn};
use wtransport::endpoint::IncomingSession;
use wtransport::tls::{Certificate, CertificateChain, PrivateKey};
use wtransport::Identity;
use x509_parser::prelude::FromDer as _;
use wtransport::RecvStream;
use wtransport::SendStream;
use wtransport::{Endpoint, ServerConfig as WtServerConfig};

use super::annexb;
use super::wt_protocol::{
    decode_message, encode_hello_ack, encode_pong, fragment_video_datagrams, Message,
    DEFAULT_DATAGRAM, MAX_FRAME,
};
use super::{token_eq, ClientGuard, DisplayCtl, H264Packet, Stats, IDR_DEBOUNCE};

pub fn default_wt_port(signaling_port: u16) -> u16 {
    signaling_port.saturating_add(2)
}

#[derive(Debug, Clone)]
pub struct WtOffer {
    pub port: u16,
    pub path: &'static str,
    pub cert_sha256: String,
    pub hosts: Vec<String>,
}

pub fn advertised_hosts() -> Vec<String> {
    let mut hosts = Vec::new();
    if let Ok(sock) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if sock.connect("1.1.1.1:80").is_ok() {
            if let Ok(addr) = sock.local_addr() {
                if let std::net::IpAddr::V4(ip) = addr.ip() {
                    if !ip.is_loopback() && !ip.is_unspecified() {
                        hosts.push(ip.to_string());
                    }
                }
            }
        }
    }
    hosts.push("127.0.0.1".into());
    hosts
}

fn host_now_ns() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0)
}

fn idr_due(last: Instant, now: Instant) -> bool {
    now.duration_since(last) >= IDR_DEBOUNCE
}

#[allow(missing_debug_implementations)]
pub struct WtHub {
    pub offer: WtOffer,
    identity: Identity,
}

/// Regenerate before WebTransport's 14-day cap is actually hit.
const CERT_RENEW_SLACK: Duration = Duration::from_secs(24 * 60 * 60);

fn default_identity_paths() -> (PathBuf, PathBuf) {
    (
        orbiscreen_core::default_wt_cert_path(),
        orbiscreen_core::default_wt_key_path(),
    )
}

fn cert_usable(der: &[u8], slack: Duration) -> bool {
    let Ok((_, cert)) = x509_parser::certificate::X509Certificate::from_der(der) else {
        return false;
    };
    let Ok(now) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return false;
    };
    let slack_secs = i64::try_from(slack.as_secs()).unwrap_or(i64::MAX);
    cert.validity().not_after.timestamp() > now.as_secs() as i64 + slack_secs
}

fn load_identity(cert_path: &Path, key_path: &Path) -> Result<Identity, String> {
    let cert_pem = std::fs::read(cert_path).map_err(|e| format!("read cert: {e}"))?;
    let key_pem = std::fs::read(key_path).map_err(|e| format!("read key: {e}"))?;
    let cert_der =
        CertificateDer::from_pem_slice(&cert_pem).map_err(|e| format!("cert pem: {e}"))?;
    if !cert_usable(&cert_der, CERT_RENEW_SLACK) {
        return Err("certificate expired or expiring".into());
    }
    let cert = Certificate::from_der(cert_der.to_vec()).map_err(|e| format!("cert der: {e}"))?;
    let key_der = PrivateKeyDer::from_pem_slice(&key_pem).map_err(|e| format!("key pem: {e}"))?;
    let key = PrivateKey::from_der_pkcs8(key_der.secret_der().to_vec());
    Ok(Identity::new(CertificateChain::single(cert), key))
}

fn write_secret_file(path: &Path, contents: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt as _;
            let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt as _;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o600)
            .open(path)?;
        file.write_all(contents)?;
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, contents)?;
    }
    Ok(())
}

fn store_identity(identity: &Identity, cert_path: &Path, key_path: &Path) -> Result<(), String> {
    let cert = identity
        .certificate_chain()
        .as_slice()
        .first()
        .ok_or_else(|| "webtransport identity has no certificate".to_string())?;
    write_secret_file(cert_path, cert.to_pem().as_bytes())
        .map_err(|e| format!("write cert: {e}"))?;
    write_secret_file(key_path, identity.private_key().to_secret_pem().as_bytes())
        .map_err(|e| format!("write key: {e}"))?;
    Ok(())
}

impl WtHub {
    pub fn new(port: u16) -> Result<Self, String> {
        let (cert_path, key_path) = default_identity_paths();
        Self::load_or_create(port, &cert_path, &key_path)
    }

    pub fn load_or_create(port: u16, cert_path: &Path, key_path: &Path) -> Result<Self, String> {
        let hosts = advertised_hosts();
        let mut sans = vec!["localhost".to_string(), "127.0.0.1".to_string()];
        for h in &hosts {
            if !sans.contains(h) {
                sans.push(h.clone());
            }
        }
        let identity = match load_identity(cert_path, key_path) {
            Ok(identity) => {
                info!(
                    cert = %cert_path.display(),
                    "reusing persisted WebTransport certificate"
                );
                identity
            }
            Err(reason) => {
                debug!(
                    cert = %cert_path.display(),
                    reason,
                    "generating a new WebTransport certificate"
                );
                let identity = Identity::self_signed(&sans).map_err(|e| e.to_string())?;
                if let Err(e) = store_identity(&identity, cert_path, key_path) {
                    warn!(
                        cert = %cert_path.display(),
                        "could not persist WebTransport certificate: {e}"
                    );
                } else {
                    info!(
                        cert = %cert_path.display(),
                        "stored WebTransport certificate"
                    );
                }
                identity
            }
        };
        let cert = identity
            .certificate_chain()
            .as_slice()
            .first()
            .ok_or_else(|| "webtransport identity has no certificate".to_string())?;
        let hash = cert.hash();
        let cert_sha256 = B64.encode(hash.as_ref());
        Ok(Self {
            offer: WtOffer {
                port,
                path: "/orbiscreen",
                cert_sha256,
                hosts,
            },
            identity,
        })
    }

    pub fn https_pem(&self) -> Result<(Vec<u8>, Vec<u8>), String> {
        let cert = self
            .identity
            .certificate_chain()
            .as_slice()
            .first()
            .ok_or_else(|| "webtransport identity has no certificate".to_string())?;
        Ok((
            cert.to_pem().into_bytes(),
            self.identity.private_key().to_secret_pem().into_bytes(),
        ))
    }
}

struct WtCtx {
    token: String,
    video: broadcast::Sender<H264Packet>,
    idr_tx: Option<tokio::sync::mpsc::Sender<()>>,
    stats: Arc<Stats>,
    displays: Option<DisplayCtl>,
    width: u32,
    height: u32,
}

#[allow(clippy::too_many_arguments)]
pub async fn run_wt_hub(
    hub: WtHub,
    token: String,
    video: broadcast::Sender<H264Packet>,
    idr_tx: Option<tokio::sync::mpsc::Sender<()>>,
    stats: Arc<Stats>,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
    displays: Option<DisplayCtl>,
    width: u32,
    height: u32,
) {
    let port = hub.offer.port;
    let config = WtServerConfig::builder()
        .with_bind_address(std::net::SocketAddr::from(([0, 0, 0, 0], port)))
        .with_identity(hub.identity)
        .build();
    let server = match Endpoint::server(config) {
        Ok(s) => s,
        Err(e) => {
            warn!("WebTransport bind {port} failed: {e}");
            return;
        }
    };
    info!(
        port,
        path = hub.offer.path,
        hosts = ?hub.offer.hosts,
        "WebTransport Annex-B listening"
    );
    let ctx = Arc::new(WtCtx {
        token,
        video,
        idr_tx,
        stats,
        displays,
        width,
        height,
    });
    loop {
        tokio::select! {
            _ = shutdown.changed() => break,
            incoming = server.accept() => {
                let ctx = ctx.clone();
                tokio::spawn(async move {
                    if let Err(e) = accept_session(incoming, ctx).await {
                        debug!("webtransport session ended: {e}");
                    }
                });
            }
        }
    }
}

async fn accept_session(incoming: IncomingSession, ctx: Arc<WtCtx>) -> Result<(), String> {
    let request = incoming.await.map_err(|e| e.to_string())?;
    if request.path() != "/orbiscreen" {
        request.not_found().await;
        return Err("wrong path".into());
    }
    let connection = request.accept().await.map_err(|e| e.to_string())?;
    let (send, recv) = connection.accept_bi().await.map_err(|e| e.to_string())?;
    handle_session(connection, send, recv, ctx).await
}

async fn handle_session(
    connection: wtransport::Connection,
    mut send: SendStream,
    mut recv: RecvStream,
    ctx: Arc<WtCtx>,
) -> Result<(), String> {
    let hello = match read_message(&mut recv).await? {
        Some(Message::Hello(h)) => h,
        Some(_) => return Err("expected hello".into()),
        None => return Err("closed before hello".into()),
    };
    if !token_eq(&hello.token, &ctx.token) {
        ctx.stats.note_auth_failure();
        return Err("bad token".into());
    }
    let ack = encode_hello_ack(
        ctx.width.min(u32::from(u16::MAX)) as u16,
        ctx.height.min(u32::from(u16::MAX)) as u16,
    )
    .map_err(|e| format!("{e:?}"))?;
    write_all(&mut send, &ack).await?;

    let attached = if let Some(ctl) = &ctx.displays {
        let id = if hello.session.is_empty() {
            None
        } else {
            Some(hello.session.clone())
        };
        match ctl.attach(id).await {
            Ok(att) => Some(att),
            Err(e) => {
                warn!("webtransport attach failed: {e}");
                return Err(e);
            }
        }
    } else {
        None
    };
    let session_id = attached.as_ref().map(|a| a.info.id.clone());
    let mut video_rx = if let Some(att) = attached {
        att.video
    } else {
        ctx.video.subscribe()
    };

    ctx.stats.client_started();
    let _guard = ClientGuard(ctx.stats.clone());
    struct DetachGuard(Option<(DisplayCtl, String)>);
    impl Drop for DetachGuard {
        fn drop(&mut self) {
            if let Some((ctl, id)) = self.0.take() {
                tokio::spawn(async move { ctl.detach(&id).await });
            }
        }
    }
    let _detach = DetachGuard(ctx.displays.clone().zip(session_id.clone()));

    let mut last_idr = Instant::now()
        .checked_sub(IDR_DEBOUNCE)
        .unwrap_or_else(Instant::now);
    let mut request_idr = || {
        let now = Instant::now();
        if !idr_due(last_idr, now) {
            return;
        }
        last_idr = now;
        if let (Some(ctl), Some(id)) = (ctx.displays.as_ref(), session_id.as_ref()) {
            let ctl = ctl.clone();
            let id = id.clone();
            tokio::spawn(async move { ctl.idr(&id).await });
        } else if let Some(tx) = &ctx.idr_tx {
            let _ = tx.try_send(());
        }
    };
    request_idr();

    let mut wait_key = true;
    let mut seq: u16 = 0;
    let mut max_datagram = connection
        .max_datagram_size()
        .unwrap_or(0)
        .clamp(0, DEFAULT_DATAGRAM);
    let mut use_datagrams = max_datagram >= super::wt_protocol::DATAGRAM_HEADER + 64;
    if !use_datagrams {
        info!(
            max_datagram,
            "webtransport peer has no datagrams; sending video on the control stream"
        );
    } else {
        info!(max_datagram, "webtransport video via QUIC datagrams");
    }
    let mut buf = Vec::new();
    loop {
        tokio::select! {
            incoming = read_into(&mut recv, &mut buf) => {
                incoming?;
                while let Some(msg) = pop_message(&mut buf)? {
                    match msg {
                        Message::Idr => request_idr(),
                        Message::Ping(t0) => {
                            let pong = encode_pong(t0, host_now_ns()).map_err(|e| format!("{e:?}"))?;
                            write_all(&mut send, &pong).await?;
                        }
                        Message::Bye => return Ok(()),
                        Message::Hello(_) | Message::HelloAck(_) | Message::Video(_) | Message::Pong { .. } => {}
                    }
                }
            }
            pkt = video_rx.recv() => {
                let pkt = match pkt {
                    Ok(p) => p,
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        wait_key = true;
                        request_idr();
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => return Ok(()),
                };
                if wait_key {
                    if !pkt.is_keyframe {
                        request_idr();
                        continue;
                    }
                    wait_key = false;
                }
                if !annexb::is_annexb(&pkt.bytes) {
                    continue;
                }
                if use_datagrams {
                    if let Some(sz) = connection.max_datagram_size() {
                        max_datagram = sz.clamp(256, DEFAULT_DATAGRAM);
                    }
                    let dgrams = fragment_video_datagrams(seq, &pkt, host_now_ns(), max_datagram);
                    seq = seq.wrapping_add(1);
                    let mut drop_rest = false;
                    for dgram in dgrams {
                        match connection.send_datagram(&dgram) {
                            Ok(()) => {}
                            Err(wtransport::error::SendDatagramError::TooLarge) => {
                                max_datagram = max_datagram.saturating_sub(64).max(256);
                                drop_rest = true;
                                wait_key = true;
                                request_idr();
                                break;
                            }
                            Err(wtransport::error::SendDatagramError::NotConnected) => {
                                return Ok(());
                            }
                            Err(wtransport::error::SendDatagramError::UnsupportedByPeer) => {
                                use_datagrams = false;
                                drop_rest = true;
                                break;
                            }
                        }
                    }
                    if drop_rest && use_datagrams {
                        continue;
                    }
                    if !use_datagrams {
                        let frame = super::wt_protocol::encode_video(&pkt, host_now_ns())
                            .map_err(|e| format!("{e:?}"))?;
                        if write_all(&mut send, &frame).await.is_err() {
                            return Ok(());
                        }
                    }
                } else {
                    let frame = super::wt_protocol::encode_video(&pkt, host_now_ns())
                        .map_err(|e| format!("{e:?}"))?;
                    if write_all(&mut send, &frame).await.is_err() {
                        return Ok(());
                    }
                }
            }
        }
    }
}

async fn write_all(send: &mut SendStream, bytes: &[u8]) -> Result<(), String> {
    send.write_all(bytes).await.map_err(|e| e.to_string())
}

async fn read_into(recv: &mut RecvStream, buf: &mut Vec<u8>) -> Result<(), String> {
    let mut tmp = [0u8; 8192];
    match recv.read(&mut tmp).await {
        Ok(Some(n)) => {
            buf.extend_from_slice(&tmp[..n]);
            Ok(())
        }
        Ok(None) => Err("stream closed".into()),
        Err(e) => Err(e.to_string()),
    }
}

async fn read_message(recv: &mut RecvStream) -> Result<Option<Message>, String> {
    let mut buf = Vec::new();
    loop {
        read_into(recv, &mut buf).await?;
        if let Some(msg) = pop_message(&mut buf)? {
            return Ok(Some(msg));
        }
        if buf.len() > MAX_FRAME + 4 {
            return Err("hello frame too large".into());
        }
    }
}

fn pop_message(buf: &mut Vec<u8>) -> Result<Option<Message>, String> {
    match super::wt_protocol::split_frame(buf) {
        Ok(Some((body, n))) => {
            let msg = decode_message(body).map_err(|e| format!("{e:?}"))?;
            buf.drain(..n);
            Ok(Some(msg))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("{e:?}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_port_is_signaling_plus_two() {
        assert_eq!(default_wt_port(8788), 8790);
        assert_eq!(default_wt_port(u16::MAX), u16::MAX);
    }

    #[test]
    fn advertised_hosts_includes_loopback() {
        let hosts = advertised_hosts();
        assert!(hosts.iter().any(|h| h == "127.0.0.1"));
    }

    #[test]
    fn self_signed_offer_has_sha256() {
        let hub = WtHub::new(0).expect("identity");
        let raw = B64.decode(&hub.offer.cert_sha256).expect("b64");
        assert_eq!(raw.len(), 32);
        assert_eq!(hub.offer.path, "/orbiscreen");
    }

    #[tokio::test]
    async fn hello_and_video_over_webtransport() {
        use crate::wt_protocol::{decode_message, encode_hello, split_frame, Message};
        use crate::H264Packet;
        use std::sync::Arc;
        use tokio::sync::{broadcast, watch};
        use wtransport::tls::Sha256Digest;
        use wtransport::ClientConfig;
        use wtransport::Endpoint;

        let port = 18790;
        let hub = WtHub::new(port).expect("identity");
        let mut digest = [0u8; 32];
        digest.copy_from_slice(&B64.decode(&hub.offer.cert_sha256).unwrap());
        let token = "wt-test-token".to_string();
        let (video_tx, _) = broadcast::channel::<H264Packet>(8);
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let stats = Arc::new(crate::Stats::default());
        let pump = video_tx.clone();
        let server = tokio::spawn(run_wt_hub(
            hub,
            token.clone(),
            video_tx,
            None,
            stats,
            shutdown_rx,
            None,
            640,
            480,
        ));
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;

        let client_cfg = ClientConfig::builder()
            .with_bind_default()
            .with_server_certificate_hashes([Sha256Digest::new(digest)])
            .build();
        let url = format!("https://127.0.0.1:{port}/orbiscreen");
        let connection = Endpoint::client(client_cfg)
            .expect("client endpoint")
            .connect(&url)
            .await
            .expect("connect");
        let (mut send, mut recv) = connection.open_bi().await.expect("open").await.expect("bi");
        send.write_all(&encode_hello(&token, "").unwrap())
            .await
            .expect("hello");

        let mut buf = Vec::new();
        let mut tmp = [0u8; 2048];
        let ack = loop {
            let n = recv.read(&mut tmp).await.expect("read").expect("eof");
            buf.extend_from_slice(&tmp[..n]);
            if let Some((body, used)) = split_frame(&buf).unwrap() {
                let msg = decode_message(body).unwrap();
                buf.drain(..used);
                break msg;
            }
        };
        match ack {
            Message::HelloAck(a) => {
                assert_eq!(a.width, 640);
                assert_eq!(a.height, 480);
            }
            other => panic!("{other:?}"),
        }

        pump.send(H264Packet {
            bytes: vec![0, 0, 0, 1, 0x65, 9],
            is_keyframe: true,
            pts_ns: 1,
        })
        .unwrap();

        let dgram = connection.receive_datagram().await.expect("datagram");
        let frag = crate::wt_protocol::parse_video_datagram(dgram.payload().as_ref())
            .expect("video datagram");
        assert!(frag.is_keyframe);
        assert_eq!(frag.frags, 1);
        assert_eq!(frag.payload, vec![0, 0, 0, 1, 0x65, 9]);

        let _ = shutdown_tx.send(true);
        let _ = server.await;
    }
}

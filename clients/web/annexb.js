// Orbiscreen - annexb.js (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.OrbiAnnexB = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {
    const TYPE_VIDEO = 1;
    const TYPE_HELLO = 2;
    const TYPE_HELLO_ACK = 3;
    const TYPE_PING = 4;
    const TYPE_PONG = 5;
    const TYPE_IDR = 6;
    const TYPE_BYE = 10;
    const MAX_FRAME = 4 * 1024 * 1024;
    const DATAGRAM_HEADER = 24;

    function startCodeLen(data, i) {
        if (i + 3 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
            return 3;
        }
        if (i + 4 < data.length && data[i] === 0 && data[i + 1] === 0
            && data[i + 2] === 0 && data[i + 3] === 1) {
            return 4;
        }
        return 0;
    }

    function withStartCode(nal) {
        const out = new Uint8Array(4 + nal.length);
        out[3] = 1;
        out.set(nal, 4);
        return out;
    }

    function extractSpsPps(au) {
        let sps = null;
        let pps = null;
        let i = 0;
        while (i < au.length) {
            const sc = startCodeLen(au, i);
            if (!sc) break;
            const nalStart = i + sc;
            let next = nalStart;
            while (next < au.length) {
                if (startCodeLen(au, next) && next > nalStart) break;
                next += 1;
            }
            if (nalStart < next) {
                const nal = au.subarray(nalStart, next);
                const typ = nal[0] & 0x1f;
                if (typ === 7) sps = withStartCode(nal);
                if (typ === 8) pps = withStartCode(nal);
            }
            i = next;
        }
        return { sps, pps };
    }

    function codecStringFromSps(sps) {
        if (!sps) return null;
        const sc = startCodeLen(sps, 0);
        if (!sc || sps.length < sc + 4) return null;
        if ((sps[sc] & 0x1f) !== 7) return null;
        const hex = (n) => n.toString(16).toUpperCase().padStart(2, "0");
        return `avc1.${hex(sps[sc + 1])}${hex(sps[sc + 2])}${hex(sps[sc + 3])}`;
    }

    function spsDimensions(sps) {
        if (!sps) return null;
        const sc = startCodeLen(sps, 0);
        const nal = sps.subarray(sc);
        if (nal.length < 5 || (nal[0] & 0x1f) !== 7) return null;
        let bit = 32;
        const getBits = (n) => {
            let v = 0;
            for (let i = 0; i < n; i += 1) {
                const byte = nal[bit >> 3];
                if (byte === undefined) return 0;
                v = (v << 1) | ((byte >> (7 - (bit & 7))) & 1);
                bit += 1;
            }
            return v;
        };
        const ue = () => {
            let z = 0;
            while (getBits(1) === 0) {
                z += 1;
                if (z > 31) return 0;
            }
            return z === 0 ? 0 : ((1 << z) | getBits(z)) - 1;
        };
        const profile = nal[1];
        ue();
        if (profile === 100 || profile === 110 || profile === 122 || profile === 244
            || profile === 44 || profile === 83 || profile === 86 || profile === 118
            || profile === 128 || profile === 138 || profile === 139 || profile === 134) {
            const chroma = ue();
            if (chroma === 3) getBits(1);
            ue();
            ue();
            getBits(1);
            if (getBits(1)) {
                const limit = chroma === 3 ? 12 : 8;
                for (let i = 0; i < limit; i += 1) {
                    if (getBits(1)) {
                        const last = i < 6 ? 16 : 64;
                        let next = 8;
                        for (let j = 0; j < last; j += 1) {
                            const delta = (() => {
                                let z = 0;
                                while (getBits(1) === 0) {
                                    z += 1;
                                    if (z > 31) return 0;
                                }
                                const mag = z === 0 ? 0 : ((1 << z) | getBits(z)) - 1;
                                const signed = (mag % 2 === 0) ? -(mag / 2) : (mag + 1) / 2;
                                return signed;
                            })();
                            next = (next + delta + 256) % 256;
                            if (next === 0) break;
                        }
                    }
                }
            }
        }
        ue();
        const poc = ue();
        if (poc === 0) {
            ue();
        } else if (poc === 1) {
            getBits(1);
            ue();
            ue();
            const n = ue();
            for (let i = 0; i < n; i += 1) ue();
        }
        ue();
        getBits(1);
        const wMbs = ue() + 1;
        const hMap = ue() + 1;
        const frameMbsOnly = getBits(1);
        if (!frameMbsOnly) getBits(1);
        getBits(1);
        let cropL = 0;
        let cropR = 0;
        let cropT = 0;
        let cropB = 0;
        if (getBits(1)) {
            cropL = ue();
            cropR = ue();
            cropT = ue();
            cropB = ue();
        }
        const width = wMbs * 16 - (cropL + cropR) * 2;
        const height = (2 - frameMbsOnly) * hMap * 16 - (cropT + cropB) * 2;
        if (width < 16 || height < 16 || width > 7680 || height > 4320) return null;
        return { width, height };
    }

    function concatBytes(parts) {
        let n = 0;
        for (const p of parts) n += p.length;
        const out = new Uint8Array(n);
        let o = 0;
        for (const p of parts) {
            out.set(p, o);
            o += p.length;
        }
        return out;
    }

    function u16le(n) {
        return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
    }

    function u64le(n) {
        const out = new Uint8Array(8);
        let x = BigInt(n);
        for (let i = 0; i < 8; i += 1) {
            out[i] = Number(x & 0xffn);
            x >>= 8n;
        }
        return out;
    }

    function readU16le(buf, o) {
        return buf[o] | (buf[o + 1] << 8);
    }

    function readU64le(buf, o) {
        let x = 0n;
        for (let i = 0; i < 8; i += 1) {
            x |= BigInt(buf[o + i]) << BigInt(8 * i);
        }
        return x;
    }

    function encodeFrame(body) {
        if (body.length > MAX_FRAME) throw new Error("frame too large");
        const out = new Uint8Array(4 + body.length);
        const len = body.length;
        out[0] = (len >>> 24) & 0xff;
        out[1] = (len >>> 16) & 0xff;
        out[2] = (len >>> 8) & 0xff;
        out[3] = len & 0xff;
        out.set(body, 4);
        return out;
    }

    function splitFrame(buf) {
        if (buf.length < 4) return null;
        const len = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
        if (len > MAX_FRAME) throw new Error("frame too large");
        if (buf.length < 4 + len) return null;
        return { body: buf.subarray(4, 4 + len), used: 4 + len };
    }

    function encodeHello(token, session) {
        const t = new TextEncoder().encode(token || "");
        const s = new TextEncoder().encode(session || "");
        return encodeFrame(concatBytes([
            Uint8Array.of(TYPE_HELLO),
            u16le(t.length),
            t,
            u16le(s.length),
            s,
        ]));
    }

    function encodeCtrl(kind) {
        return encodeFrame(Uint8Array.of(kind));
    }

    function encodePing(t0Ns) {
        return encodeFrame(concatBytes([Uint8Array.of(TYPE_PING), u64le(t0Ns)]));
    }

    function decodeMessage(body) {
        if (!body.length) throw new Error("empty");
        const kind = body[0];
        const rest = body.subarray(1);
        if (kind === TYPE_HELLO_ACK) {
            if (rest.length < 4) throw new Error("truncated");
            return { type: "helloAck", width: readU16le(rest, 0), height: readU16le(rest, 2) };
        }
        if (kind === TYPE_VIDEO) {
            if (rest.length < 17) throw new Error("truncated");
            return {
                type: "video",
                key: rest[0] !== 0,
                ptsNs: readU64le(rest, 1),
                sentNs: readU64le(rest, 9),
                au: rest.subarray(17),
            };
        }
        if (kind === TYPE_PONG) {
            if (rest.length < 16) throw new Error("truncated");
            return { type: "pong", t0Ns: readU64le(rest, 0), hostNs: readU64le(rest, 8) };
        }
        if (kind === TYPE_IDR) return { type: "idr" };
        if (kind === TYPE_BYE) return { type: "bye" };
        if (kind === TYPE_PING) return { type: "ping", t0Ns: readU64le(rest, 0) };
        if (kind === TYPE_HELLO) return { type: "hello" };
        throw new Error(`unknown type ${kind}`);
    }

    function hashFromBase64(b64) {
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
        return out;
    }

    function pickWtHost(cfg, locationHost) {
        const h = locationHost || "";
        if (h && h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]") {
            return h;
        }
        const hosts = cfg && Array.isArray(cfg.wt_hosts) ? cfg.wt_hosts : [];
        const lan = hosts.find((x) => x && x !== "127.0.0.1" && x !== "::1");
        return lan || hosts[0] || h || "127.0.0.1";
    }

    function parseVideoDatagram(buf) {
        if (!buf || buf.length < DATAGRAM_HEADER || buf[0] !== TYPE_VIDEO) return null;
        return {
            type: "video",
            key: buf[1] !== 0,
            seq: readU16le(buf, 2),
            frag: readU16le(buf, 4),
            frags: readU16le(buf, 6),
            ptsNs: readU64le(buf, 8),
            sentNs: readU64le(buf, 16),
            payload: buf.subarray(24),
        };
    }

    function encodeVideoDatagram(seq, frag, frags, key, ptsNs, sentNs, payload) {
        const out = new Uint8Array(DATAGRAM_HEADER + payload.length);
        out[0] = TYPE_VIDEO;
        out[1] = key ? 1 : 0;
        out.set(u16le(seq), 2);
        out.set(u16le(frag), 4);
        out.set(u16le(frags), 6);
        out.set(u64le(ptsNs), 8);
        out.set(u64le(sentNs), 16);
        out.set(payload, 24);
        return out;
    }

    function seqDelta(cur, prev) {
        return (cur - prev) & 0xffff;
    }

    class DatagramAssembler {
        constructor() {
            this.pending = new Map();
            this.lastSeq = -1;
        }
        push(buf) {
            const frag = parseVideoDatagram(buf);
            if (!frag || frag.frags <= 0 || frag.frag >= frag.frags) return null;
            if (this.pending.size >= 4) {
                for (const [seq] of this.pending) {
                    if (seqDelta(frag.seq, seq) > 1 && seqDelta(frag.seq, seq) < 32768) {
                        this.pending.delete(seq);
                    }
                }
            }
            let slots = this.pending.get(frag.seq);
            if (!slots || slots.frags !== frag.frags) {
                slots = {
                    frags: frag.frags,
                    key: frag.key,
                    ptsNs: frag.ptsNs,
                    sentNs: frag.sentNs,
                    parts: Array.from({ length: frag.frags }, () => null),
                };
                this.pending.set(frag.seq, slots);
            }
            slots.parts[frag.frag] = frag.payload;
            if (slots.parts.some((p) => p == null)) return null;
            this.pending.delete(frag.seq);
            const gap = this.lastSeq >= 0 && seqDelta(frag.seq, this.lastSeq) !== 1;
            this.lastSeq = frag.seq;
            if (gap && !slots.key) {
                return { type: "gap" };
            }
            return {
                type: "video",
                key: slots.key,
                ptsNs: slots.ptsNs,
                sentNs: slots.sentNs,
                au: concatBytes(slots.parts),
            };
        }
    }

    class FrameReader {
        constructor() {
            this.buf = new Uint8Array(0);
        }
        push(chunk) {
            const next = new Uint8Array(this.buf.length + chunk.length);
            next.set(this.buf, 0);
            next.set(chunk, this.buf.length);
            this.buf = next;
        }
        pop() {
            const split = splitFrame(this.buf);
            if (!split) return null;
            this.buf = this.buf.subarray(split.used);
            return decodeMessage(split.body);
        }
    }

    return {
        TYPE_VIDEO, TYPE_HELLO, TYPE_HELLO_ACK, TYPE_PING, TYPE_PONG, TYPE_IDR, TYPE_BYE,
        MAX_FRAME,
        startCodeLen, extractSpsPps, codecStringFromSps, spsDimensions, withStartCode,
        encodeFrame, splitFrame, encodeHello, encodeCtrl, encodePing, decodeMessage,
        hashFromBase64, pickWtHost, FrameReader,
        parseVideoDatagram, encodeVideoDatagram, DatagramAssembler, seqDelta, DATAGRAM_HEADER,
    };
}));

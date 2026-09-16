// Orbiscreen - annexb.test.js (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

const test = require("node:test");
const assert = require("node:assert/strict");
const annexb = require("./annexb.js");

test("spsDimensions reads High@4.0 1280x800", () => {
    const sps = Buffer.from(
        "0000000127640028ac11128050065bff0001000110000003001000000789da08042e",
        "hex",
    );
    assert.deepEqual(annexb.spsDimensions(sps), { width: 1280, height: 800 });
});

test("codec string from High@4.0 SPS", () => {
    const sps = annexb.withStartCode(Uint8Array.of(0x67, 0x64, 0x00, 0x28, 0xac));
    assert.equal(annexb.codecStringFromSps(sps), "avc1.640028");
});

test("extracts SPS/PPS from an IDR AU", () => {
    const sps = annexb.withStartCode(Uint8Array.of(0x67, 0x64, 0x00, 0x28, 0xac));
    const pps = annexb.withStartCode(Uint8Array.of(0x68, 0xee, 0x3c, 0x80));
    const slice = annexb.withStartCode(Uint8Array.of(0x65, 0x88));
    const au = new Uint8Array(sps.length + pps.length + slice.length);
    au.set(sps, 0);
    au.set(pps, sps.length);
    au.set(slice, sps.length + pps.length);
    const found = annexb.extractSpsPps(au);
    assert.deepEqual(Array.from(found.sps), Array.from(sps));
    assert.deepEqual(Array.from(found.pps), Array.from(pps));
});

test("hello frame encodes a complete length-prefixed body", () => {
    const frame = annexb.encodeHello("tok", "sess-1");
    const split = annexb.splitFrame(frame);
    assert.ok(split);
    assert.equal(split.used, frame.length);
    assert.equal(split.body[0], annexb.TYPE_HELLO);
});

test("frame reader reassembles split chunks", () => {
    const frame = annexb.encodeCtrl(annexb.TYPE_IDR);
    const reader = new annexb.FrameReader();
    reader.push(frame.subarray(0, 3));
    assert.equal(reader.pop(), null);
    reader.push(frame.subarray(3));
    const msg = reader.pop();
    assert.equal(msg.type, "idr");
    assert.equal(reader.pop(), null);
});

test("video message decode", () => {
    const au = Uint8Array.of(0, 0, 0, 1, 0x65, 9);
    const body = new Uint8Array(1 + 1 + 8 + 8 + au.length);
    body[0] = annexb.TYPE_VIDEO;
    body[1] = 1;
    body[2] = 42;
    body.set(au, 18);
    const frame = annexb.encodeFrame(body);
    const msg = annexb.decodeMessage(annexb.splitFrame(frame).body);
    assert.equal(msg.type, "video");
    assert.equal(msg.key, true);
    assert.equal(msg.ptsNs, 42n);
    assert.deepEqual(Array.from(msg.au), Array.from(au));
});

test("pickWtHost prefers the page host when it is not loopback", () => {
    assert.equal(annexb.pickWtHost({ wt_hosts: ["10.0.0.5"] }, "192.168.1.8"), "192.168.1.8");
    assert.equal(annexb.pickWtHost({ wt_hosts: ["10.0.0.5", "127.0.0.1"] }, "127.0.0.1"), "10.0.0.5");
    assert.equal(annexb.pickWtHost({ wt_hosts: ["127.0.0.1"] }, "localhost"), "127.0.0.1");
});

test("datagram assembler rebuilds a split AU and reports a gap", () => {
    const au = Uint8Array.from({ length: 40 }, (_, i) => i);
    const a = annexb.encodeVideoDatagram(4, 0, 2, true, 1n, 2n, au.subarray(0, 20));
    const b = annexb.encodeVideoDatagram(4, 1, 2, true, 1n, 2n, au.subarray(20));
    const asm = new annexb.DatagramAssembler();
    assert.equal(asm.push(a), null);
    const msg = asm.push(b);
    assert.equal(msg.type, "video");
    assert.equal(msg.key, true);
    assert.deepEqual(Array.from(msg.au), Array.from(au));

    const next = annexb.encodeVideoDatagram(6, 0, 1, false, 3n, 4n, au.subarray(0, 8));
    assert.equal(asm.push(next).type, "gap");
});

test("hashFromBase64 yields 32 bytes", () => {
    const raw = Uint8Array.from({ length: 32 }, (_, i) => i);
    const b64 = Buffer.from(raw).toString("base64");
    assert.deepEqual(Array.from(annexb.hashFromBase64(b64)), Array.from(raw));
});

// Orbiscreen - IdrFrames.kt (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

package com.orbiscreen.android.player

/**
 * Length-prefixed Annex-B video frames as sent on the reliable IDR TCP
 * path (`GET /idr`, same codec as WebTransport `encode_video`).
 */
object IdrFrames {
    const val TYPE_VIDEO: Int = 1
    const val MAX_FRAME: Int = 4 * 1024 * 1024

    data class Video(
        val key: Boolean,
        val ptsNs: Long,
        val sentNs: Long,
        val au: ByteArray,
    )

    fun split(buf: ByteArray, offset: Int = 0, length: Int = buf.size - offset): Pair<ByteArray, Int>? {
        if (length < 4) return null
        val n = ((buf[offset].toInt() and 0xff) shl 24) or
            ((buf[offset + 1].toInt() and 0xff) shl 16) or
            ((buf[offset + 2].toInt() and 0xff) shl 8) or
            (buf[offset + 3].toInt() and 0xff)
        if (n < 0 || n > MAX_FRAME) return null
        if (length < 4 + n) return null
        return buf.copyOfRange(offset + 4, offset + 4 + n) to (4 + n)
    }

    fun decodeVideo(body: ByteArray): Video? {
        if (body.isEmpty() || (body[0].toInt() and 0xff) != TYPE_VIDEO) return null
        if (body.size < 18) return null
        val key = body[1].toInt() != 0
        val pts = le64(body, 2)
        val sent = le64(body, 10)
        val au = body.copyOfRange(18, body.size)
        return Video(key, pts, sent, au)
    }

    class Reader {
        private var buf = ByteArray(0)

        fun push(chunk: ByteArray) {
            if (chunk.isEmpty()) return
            val next = ByteArray(buf.size + chunk.size)
            System.arraycopy(buf, 0, next, 0, buf.size)
            System.arraycopy(chunk, 0, next, buf.size, chunk.size)
            buf = next
        }

        fun pop(): Video? {
            val split = split(buf) ?: return null
            val (body, used) = split
            buf = buf.copyOfRange(used, buf.size)
            return decodeVideo(body)
        }
    }

    private fun le64(d: ByteArray, o: Int): Long {
        var v = 0L
        var shift = 0
        for (i in 0 until 8) {
            v = v or ((d[o + i].toLong() and 0xffL) shl shift)
            shift += 8
        }
        return v
    }
}

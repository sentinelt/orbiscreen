// Orbiscreen - Fec.kt (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

package com.orbiscreen.android.player

/** Systematic Cauchy Reed-Solomon over GF(256). Matches crates/orbiscreen-transport/src/fec.rs. */
object Fec {
    fun parityCount(k: Int): Int = when {
        k <= 3 -> 0
        k <= 16 -> 2
        k <= 64 -> 3
        else -> 4
    }

    fun recover(data: Array<ByteArray?>, parity: Array<ByteArray?>): Boolean {
        val k = data.size
        if (data.all { it != null }) return true
        val m = parity.size
        if (m == 0) return false
        val missing = data.indices.filter { data[it] == null }
        val presentP = parity.indices.filter { parity[it] != null }
        var width = 0
        for (d in data) if (d != null && d.size > width) width = d.size
        for (p in parity) if (p != null && p.size > width) width = p.size
        if (width == 0 || missing.size > presentP.size) return false
        val usedP = presentP.take(missing.size)
        val missN = missing.size
        val known = Array(k) { i ->
            data[i]?.let { src ->
                ByteArray(width).also { it.fill(0); src.copyInto(it) }
            }
        }
        val rhs = Array(missN) { r ->
            val p = usedP[r]
            val rec = ByteArray(width).also { parity[p]!!.copyInto(it) }
            ByteArray(width) { b ->
                var s = rec[b].toInt() and 0xff
                for (d in 0 until k) {
                    val kn = known[d]
                    if (kn != null) s = s xor gfMul(cauchy(p, d, m), kn[b].toInt() and 0xff)
                }
                s.toByte()
            }
        }
        val mat = Array(missN) { r ->
            val p = usedP[r]
            ByteArray(missN) { c -> cauchy(p, missing[c], m).toByte() }
        }
        val inv = invert(mat) ?: return false
        for (c in 0 until missN) {
            val out = ByteArray(width)
            for (b in 0 until width) {
                var s = 0
                for (r in 0 until missN) {
                    s = s xor gfMul(inv[c][r].toInt() and 0xff, rhs[r][b].toInt() and 0xff)
                }
                out[b] = s.toByte()
            }
            data[missing[c]] = out
        }
        return true
    }

    fun concatFecAu(parts: Array<ByteArray>): ByteArray? {
        val n = parts.sumOf { it.size }
        if (n < 4) return null
        val blob = ByteArray(n)
        var o = 0
        for (p in parts) {
            p.copyInto(blob, o)
            o += p.size
        }
        val len = (blob[0].toInt() and 0xff) or
            ((blob[1].toInt() and 0xff) shl 8) or
            ((blob[2].toInt() and 0xff) shl 16) or
            ((blob[3].toInt() and 0xff) shl 24)
        if (len < 0 || len > blob.size - 4) return null
        return blob.copyOfRange(4, 4 + len)
    }

    internal fun encode(data: Array<ByteArray>, m: Int): Array<ByteArray> {
        val k = data.size
        val width = data[0].size
        return Array(m) { p ->
            ByteArray(width) { b ->
                var s = 0
                for (d in 0 until k) {
                    s = s xor gfMul(cauchy(p, d, m), data[d][b].toInt() and 0xff)
                }
                s.toByte()
            }
        }
    }

    private fun cauchy(p: Int, d: Int, m: Int): Int = gfInv(p xor (m + d))

    private val exp = ByteArray(512)
    private val log = ByteArray(256)

    init {
        var x = 1
        for (i in 0 until 255) {
            exp[i] = x.toByte()
            log[x] = i.toByte()
            x = x shl 1
            if (x and 0x100 != 0) x = x xor 0x11d
        }
        for (i in 255 until 512) exp[i] = exp[i - 255]
    }

    private fun gfMul(a: Int, b: Int): Int {
        if (a == 0 || b == 0) return 0
        return exp[(log[a].toInt() and 0xff) + (log[b].toInt() and 0xff)].toInt() and 0xff
    }

    private fun gfInv(a: Int): Int = exp[255 - (log[a].toInt() and 0xff)].toInt() and 0xff

    private fun invert(a: Array<ByteArray>): Array<ByteArray>? {
        val n = a.size
        if (n == 0) return emptyArray()
        val m = Array(n) { i ->
            ByteArray(n * 2).also { row ->
                a[i].copyInto(row)
                row[n + i] = 1
            }
        }
        for (col in 0 until n) {
            var piv = col
            while (piv < n && m[piv][col].toInt() == 0) piv++
            if (piv == n) return null
            val tmp = m[col]
            m[col] = m[piv]
            m[piv] = tmp
            val inv = gfInv(m[col][col].toInt() and 0xff)
            for (j in 0 until n * 2) {
                m[col][j] = gfMul(m[col][j].toInt() and 0xff, inv).toByte()
            }
            for (row in 0 until n) {
                if (row == col) continue
                val f = m[row][col].toInt() and 0xff
                if (f == 0) continue
                for (j in 0 until n * 2) {
                    val v = (m[row][j].toInt() and 0xff) xor gfMul(f, m[col][j].toInt() and 0xff)
                    m[row][j] = v.toByte()
                }
            }
        }
        return Array(n) { i -> m[i].copyOfRange(n, n * 2) }
    }
}

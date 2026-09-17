// Orbiscreen - PendingFecStore.kt (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

package com.orbiscreen.android.player

class PendingFecStore {
    data class Complete(
        val seq: Int,
        val key: Boolean,
        val sentNs: Long,
        val au: ByteArray,
    )

    private class PendingAu(
        val k: Int,
        val parts: Array<ByteArray?>,
        val parity: Array<ByteArray?>,
        var key: Boolean,
        var sentNs: Long,
    )

    private val pending = HashMap<Int, PendingAu>()

    val size: Int get() = pending.size
    fun contains(seq: Int): Boolean = pending.containsKey(seq)
    fun remove(seq: Int) { pending.remove(seq) }
    fun clear() { pending.clear() }
    fun keys(): Set<Int> = pending.keys.toSet()

    fun offer(
        seq: Int,
        frag: Int,
        frags: Int,
        key: Boolean,
        sentNs: Long,
        payload: ByteArray,
    ): Complete? {
        val m = Fec.parityCount(frags)
        if (frags <= 0 || frag < 0 || frag >= frags + m) return null
        val isParity = frag >= frags
        var slots = pending[seq]
        if (slots == null || slots.k != frags) {
            if (isParity) return null
            slots = PendingAu(
                frags,
                arrayOfNulls(frags),
                arrayOfNulls(m),
                key,
                sentNs,
            )
            pending[seq] = slots
        }
        if (isParity) {
            slots.parity[frag - frags] = payload
        } else {
            slots.parts[frag] = payload
            slots.key = key
            slots.sentNs = sentNs
        }
        if (slots.parts.all { it != null }) {
            pending.remove(seq)
            val filled = Array(frags) { i -> slots.parts[i]!! }
            val au = if (m > 0) Fec.concatFecAu(filled) ?: return null else assemble(slots.parts)
            return Complete(seq, slots.key, slots.sentNs, au)
        }
        val have = slots.parts.count { it != null } + slots.parity.count { it != null }
        if (have < frags) return null
        if (!Fec.recover(slots.parts, slots.parity)) return null
        pending.remove(seq)
        val filled = Array(frags) { i -> slots.parts[i]!! }
        val au = Fec.concatFecAu(filled) ?: return null
        return Complete(seq, slots.key, slots.sentNs, au)
    }

    private fun assemble(slots: Array<ByteArray?>): ByteArray {
        var total = 0
        for (p in slots) total += p?.size ?: 0
        val out = ByteArray(total)
        var o = 0
        for (p in slots) {
            if (p == null) continue
            System.arraycopy(p, 0, out, o, p.size)
            o += p.size
        }
        return out
    }
}

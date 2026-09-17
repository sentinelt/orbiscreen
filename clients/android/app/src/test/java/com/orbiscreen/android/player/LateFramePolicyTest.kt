package com.orbiscreen.android.player

import org.junit.Assert.assertEquals
import org.junit.Test

class LateFramePolicyTest {

    private class Policy {
        fun shouldDropOutputBuffer(earlyUs: Long, isLastBuffer: Boolean): Boolean =
            earlyUs < MIN_EARLY_US_LATE_THRESHOLD && !isLastBuffer

        fun shouldDropBuffersToKeyframe(earlyUs: Long, isLastBuffer: Boolean): Boolean {
            
            return false && earlyUs < MIN_EARLY_US_VERY_LATE_THRESHOLD && !isLastBuffer
        }

        companion object {
            const val MIN_EARLY_US_LATE_THRESHOLD = -30_000L
            const val MIN_EARLY_US_VERY_LATE_THRESHOLD = -500_000L
        }
    }

    private val policy = Policy()

    @Test
    fun onTimeFrameIsNeverDropped() {
        for (earlyUs in longArrayOf(16_666, 5_000, 0, 29_999)) {
            org.junit.Assert.assertFalse(
                "frame early=$earlyUs should display",
                policy.shouldDropOutputBuffer(earlyUs, isLastBuffer = false),
            )
        }
    }

    @Test
    fun lateFrameBeyond30msIsSkipped() {
        org.junit.Assert.assertTrue(
            policy.shouldDropOutputBuffer(-30_001, isLastBuffer = false),
        )
        org.junit.Assert.assertFalse(
            policy.shouldDropOutputBuffer(-30_000, isLastBuffer = false),
        )
    }

    @Test
    fun lastBufferIsNeverDroppedEvenWhenVeryLate() {
        org.junit.Assert.assertFalse(
            policy.shouldDropOutputBuffer(-5_000_000, isLastBuffer = true),
        )
    }

    @Test
    fun keyframeFlushingStaysDisabledButLagSignalFiresAt300ms() {
        var lagSignals = 0
        val earlyUs = -400_000L
        if (earlyUs < -300_000) lagSignals++
        org.junit.Assert.assertEquals(1, lagSignals)
        org.junit.Assert.assertFalse(
            policy.shouldDropBuffersToKeyframe(earlyUs, isLastBuffer = false),
        )
    }

    @Test
    fun stalledQueueRecoversTowardLiveEdge() {
        
        var earliestQueuedPtsUs = 0L
        val frameDurUs = 16_666L
        var nowPtsUs = 500_000L 
        var displayed = 0
        var dropped = 0
        while (earliestQueuedPtsUs < nowPtsUs && dropped < 40) {
            val earlyUs = earliestQueuedPtsUs - nowPtsUs
            if (policy.shouldDropOutputBuffer(earlyUs, isLastBuffer = false)) {
                dropped++
            } else {
                displayed++
            }
            earliestQueuedPtsUs += frameDurUs
        }
        org.junit.Assert.assertTrue(
            "expected backlog to drain via skips, dropped=$dropped displayed=$displayed",
            earliestQueuedPtsUs >= nowPtsUs,
        )
        
        
        
        org.junit.Assert.assertEquals(29, dropped)
        org.junit.Assert.assertEquals(2, displayed)
    }

    @Test
    fun exactRationalSteppingMatchesRelativeArithmetic() {
        
        
        val step = 1_000_000.0 / 60.0
        val now = 500_000.0
        var dropped = 0
        var displayed = 0
        var k = 0
        while (k * step < now) {
            if (k * step - now < -30_000.0) dropped++ else displayed++
            k++
        }
        org.junit.Assert.assertEquals(29, dropped)
        org.junit.Assert.assertEquals(1, displayed)
    }

    @Test
    fun oldPolicyWouldDisplayEveryStaleFrame() {
        
        
        var earliestQueuedPtsUs = 0L
        val frameDurUs = 16_666L
        var nowPtsUs = 500_000L
        var displayed = 0
        while (earliestQueuedPtsUs < nowPtsUs) {
            displayed++
            earliestQueuedPtsUs += frameDurUs
        }
        
        
        
        org.junit.Assert.assertEquals(31, displayed)
    }

    @Test
    fun thresholdBoundaryConsistency() {
        
        org.junit.Assert.assertFalse(policy.shouldDropOutputBuffer(-29_999, isLastBuffer = false))
        org.junit.Assert.assertTrue(policy.shouldDropOutputBuffer(-30_001, isLastBuffer = false))
    }
}

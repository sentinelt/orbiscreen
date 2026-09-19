// Orbiscreen - InputDispatcher.kt (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

package com.orbiscreen.android.input

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

private const val TAG = "Orbi.Input"

internal class VirtualCursor(initialWidth: Int, initialHeight: Int) {
    private var maxX = (initialWidth - 1).coerceAtLeast(0).toFloat()
    private var maxY = (initialHeight - 1).coerceAtLeast(0).toFloat()

    var x: Float = (initialWidth / 2).toFloat().coerceIn(0f, maxX)
        private set
    var y: Float = (initialHeight / 2).toFloat().coerceIn(0f, maxY)
        private set

    fun applyDelta(dx: Float, dy: Float) {
        
        
        
        x = (x + dx).coerceIn(0f, maxX)
        y = (y + dy).coerceIn(0f, maxY)
    }

    fun place(px: Float, py: Float) {
        x = px.coerceIn(0f, maxX)
        y = py.coerceIn(0f, maxY)
    }

    fun resize(width: Int, height: Int) {
        maxX = (width - 1).coerceAtLeast(0).toFloat()
        maxY = (height - 1).coerceAtLeast(0).toFloat()
        x = x.coerceIn(0f, maxX)
        y = y.coerceIn(0f, maxY)
    }
}

internal class OrderedInputQueue<T>(capacity: Int = 64) {
    private class Entry<T>(var values: List<T>, val motionKey: String?) {
        var consumed = false
    }

    private val channel = Channel<Entry<T>>(capacity)
    private val producerLock = Any()
    private var tail: Entry<T>? = null
    @Volatile
    private var closed = false

    fun submit(values: List<T>, motionKey: String? = null): Boolean = synchronized(producerLock) {
        if (closed) return false
        val previous = tail
        if (motionKey != null && previous?.motionKey == motionKey) {
            synchronized(previous) {
                if (!previous.consumed) {
                    previous.values = values
                    return true
                }
            }
        }
        val entry = Entry(values, motionKey)
        val sent = channel.trySend(entry).isSuccess
        if (!sent) {
            if (motionKey == null) {
                if (channel.trySendBlocking(entry).isFailure) return false
            } else {
                return false
            }
        }
        tail = entry
        true
    }

    suspend fun drain(deliver: (T) -> Unit) {
        try {
            for (entry in channel) {
                var currentEntry = entry
                while (currentEntry.motionKey != null) {
                    val next = channel.tryReceive().getOrNull() ?: break
                    if (next.motionKey == currentEntry.motionKey) {
                        currentEntry = next
                    } else {
                        val values = synchronized(currentEntry) {
                            currentEntry.consumed = true
                            currentEntry.values
                        }
                        for (value in values) deliver(value)
                        currentEntry = next
                    }
                }
                val values = synchronized(currentEntry) {
                    currentEntry.consumed = true
                    currentEntry.values
                }
                for (value in values) deliver(value)
            }
        } catch (_: kotlinx.coroutines.CancellationException) {
            // normal termination
        }
    }

    fun close() {
        closed = true
        channel.close()
    }
}

class InputDispatcher(
    private val host: String,
    private val port: Int,
    displayWidth: Int,
    displayHeight: Int,
    token: String = "",
    private val tokenProvider: (() -> String)? = null,
    private val sessionIdProvider: (() -> String?)? = null,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder()
        .connectionPool(okhttp3.ConnectionPool(5, 5, TimeUnit.MINUTES))
        .connectTimeout(500, TimeUnit.MILLISECONDS)
        .readTimeout(500, TimeUnit.MILLISECONDS)
        .writeTimeout(500, TimeUnit.MILLISECONDS)
        .build()

    @Volatile
    private var token: String = token

    @Volatile
    var sessionId: String? = null

    private var streamWidth: Int = displayWidth
    private var streamHeight: Int = displayHeight
    private var lastStylusPressure: Float = 0f

    
    private val pointer = VirtualCursor(streamWidth, streamHeight)
    private val queue = OrderedInputQueue<JSONObject>()

    init {
        scope.launch {
            try {
                queue.drain { send(it) }
            } finally {
                queue.close()
                http.dispatcher.executorService.shutdown()
                http.connectionPool.evictAll()
                scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
            }
        }
        Log.i(TAG, "InputDispatcher created → target=$host:$port")
    }

    @Synchronized
    fun resize(newWidth: Int, newHeight: Int) {
        if (newWidth <= 0 || newHeight <= 0) return
        streamWidth = newWidth
        streamHeight = newHeight
        pointer.resize(newWidth, newHeight)
    }

    fun updateToken(value: String) {
        if (value.isNotBlank()) token = value
    }

    @Volatile
    var pointerSpeed: Float = 1.0f

    private fun movePayload(): JSONObject = JSONObject().apply {
        put("Pointer", JSONObject().apply {
            put("Move", JSONObject().apply {
                put("x", pointer.x.toDouble())
                put("y", pointer.y.toDouble())
            })
        })
    }

    private fun buttonPayload(button: Int, pressed: Boolean): JSONObject = JSONObject().apply {
        put("Pointer", JSONObject().apply {
            put("Button", JSONObject().apply {
                put("button", button)
                put("pressed", pressed)
            })
        })
    }

    @Synchronized
    fun move(localX: Float, localY: Float, containerW: Int, containerH: Int) {
        val (x, y) = map(localX, localY, containerW, containerH)
        pointer.place(x.toFloat(), y.toFloat())
        queue.submit(listOf(movePayload()), "pointer")
    }

    @Synchronized
    fun moveDelta(dx: Float, dy: Float) {
        val sensitivity = pointerSpeed
        pointer.applyDelta(dx * sensitivity, dy * sensitivity)
        queue.submit(listOf(movePayload()), "pointer")
    }

    @Synchronized
    fun pointerAction(
        localX: Float?,
        localY: Float?,
        containerW: Int,
        containerH: Int,
        button: Int,
        pressed: Boolean,
    ) {
        if (localX != null && localY != null && containerW > 0 && containerH > 0) {
            val (x, y) = map(localX, localY, containerW, containerH)
            pointer.place(x.toFloat(), y.toFloat())
        }
        queue.submit(listOf(movePayload(), buttonPayload(button, pressed)))
    }

    @Synchronized
    fun button(button: Int, pressed: Boolean) {
        queue.submit(listOf(buttonPayload(button, pressed)))
    }

    fun leftClick() = click(1)

    fun rightClick() = click(3)

    @Synchronized
    private fun click(button: Int) {
        queue.submit(listOf(movePayload(), buttonPayload(button, true), buttonPayload(button, false)))
    }

    @Synchronized
    fun wheel(deltaY: Double) {
        val payload = JSONObject().apply {
            put("Pointer", JSONObject().apply {
                put("Wheel", JSONObject().apply { put("delta_y", deltaY) })
            })
        }
        queue.submit(listOf(payload))
    }

    @Synchronized
    fun touch(
        slot: Int,
        id: Int,
        localX: Float,
        localY: Float,
        containerW: Int,
        containerH: Int,
        pressed: Boolean,
        coalesce: Boolean = false,
    ) {
        val (x, y) = map(localX, localY, containerW, containerH)
        val payload = JSONObject().apply {
            put("Touch", JSONObject().apply {
                put("slot", slot)
                put("id", id)
                put("x", x.toDouble())
                put("y", y.toDouble())
                put("pressed", pressed)
            })
        }
        queue.submit(listOf(payload), if (coalesce && pressed) "touch:$slot:$id" else null)
        if (!coalesce || !pressed) {
            Log.d(TAG, "touch slot=$slot id=$id pressed=$pressed")
        }
    }

    @Synchronized
    fun stylus(
        xPx: Float,
        yPx: Float,
        wView: Int,
        hView: Int,
        pressure: Float,
        tiltXDeg: Float = 0f,
        tiltYDeg: Float = 0f,
    ) {
        if (wView <= 0 || hView <= 0) return
        val normX = (xPx.coerceIn(0f, wView.toFloat()) / wView.toFloat()) * streamWidth.toFloat()
        val normY = (yPx.coerceIn(0f, hView.toFloat()) / hView.toFloat()) * streamHeight.toFloat()
        val pressNorm = pressure.coerceIn(0f, 1f).toDouble()

        val stylusObj = JSONObject().apply {
            if (tiltXDeg != 0f || tiltYDeg != 0f) {
                put("Tilt", JSONObject().apply {
                    put("x", normX.toDouble())
                    put("y", normY.toDouble())
                    put("pressure", pressNorm)
                    put("tilt_x_deg", tiltXDeg.toDouble())
                    put("tilt_y_deg", tiltYDeg.toDouble())
                })
            } else {
                put("Pressure", JSONObject().apply {
                    put("x", normX.toDouble())
                    put("y", normY.toDouble())
                    put("pressure", pressNorm)
                })
            }
        }
        val payload = JSONObject().apply {
            put("Stylus", stylusObj)
        }
        val motionKey = if (pressNorm > 0 && lastStylusPressure > 0) "stylus" else null
        queue.submit(listOf(payload), motionKey)
        lastStylusPressure = pressNorm.toFloat()
    }

    @Synchronized
    fun key(code: Int, pressed: Boolean) {
        val payload = JSONObject()
        payload.put("Key", JSONObject().apply {
            put("code", code)
            put("pressed", pressed)
        })
        queue.submit(listOf(payload))
    }

    fun control(
        action: String,
        args: JSONObject = JSONObject(),
        onResult: ((Boolean) -> Unit)? = null,
    ) {
        scope.launch {
            var ok = false
            val t = tokenProvider?.invoke()?.takeIf { it.isNotBlank() } ?: token
            if (t.isBlank()) {
                onResult?.invoke(false)
                return@launch
            }
            try {
                val body = JSONObject().apply {
                    put("action", action)
                    val it = args.keys()
                    while (it.hasNext()) { val k = it.next(); put(k, args.get(k)) }
                }
                val builder = Request.Builder()
                    .url("http://$host:$port/api/control")
                    .header("Authorization", "Bearer $t")
                    .post(body.toString().toRequestBody("application/json".toMediaType()))
                val sid = sessionIdProvider?.invoke()?.takeIf { it.isNotBlank() } ?: sessionId
                sid?.takeIf { it.isNotBlank() }?.let { builder.header("X-Orbiscreen-Session", it) }
                http.newCall(builder.build()).execute().use { resp ->
                    ok = resp.isSuccessful
                    if (!ok) {
                        Log.w(TAG, "control $action rejected with HTTP ${resp.code}")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "control $action failed: ${e.message}")
            }
            onResult?.invoke(ok)
        }
    }

    fun release() {
        queue.close()
    }

    private fun map(localX: Float, localY: Float, w: Int, h: Int): Pair<Int, Int> {
        if (w <= 0 || h <= 0) return 0 to 0
        val nx = (localX / w).coerceIn(0f, 1f)
        val ny = (localY / h).coerceIn(0f, 1f)
        return (nx * streamWidth).roundToInt() to (ny * streamHeight).roundToInt()
    }

    private var lastUnauthorizedMs = 0L

    private fun send(payload: JSONObject) {
        try {
            val t = tokenProvider?.invoke()?.takeIf { it.isNotBlank() } ?: token
            if (t.isBlank()) {
                return
            }
            val builder = Request.Builder()
                .url("http://$host:$port/input")
                .header("Connection", "keep-alive")
                .header("Authorization", "Bearer $t")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
            val sid = sessionIdProvider?.invoke()?.takeIf { it.isNotBlank() } ?: sessionId
            sid?.takeIf { it.isNotBlank() }?.let { builder.header("X-Orbiscreen-Session", it) }
            val call = http.newCall(builder.build())
            call.timeout().timeout(1, TimeUnit.SECONDS)
            call.timeout().timeout(500, TimeUnit.MILLISECONDS)
            call.execute().use { resp ->
                if (resp.code == 401) {
                    val now = android.os.SystemClock.elapsedRealtime()
                    if (now - lastUnauthorizedMs > 1000L) {
                        lastUnauthorizedMs = now
                        Log.w(TAG, "send rejected with HTTP 401, triggering re-auth")
                        token = ""
                        onUnauthorized?.invoke()
                    }
                } else if (!resp.isSuccessful) {
                    Log.w(TAG, "send rejected with HTTP ${resp.code}")
                }
            }
        } catch (e: Exception) {
            Log.v(TAG, "send dispatch failed: ${e.message}")
        }
    }

    var onUnauthorized: (() -> Unit)? = null
}

// Orbiscreen - StreamViewModel.kt (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

package com.orbiscreen.android.ui.stream

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.orbiscreen.android.data.PrefsStore
import com.orbiscreen.android.input.InputDispatcher
import com.orbiscreen.android.net.HostApi
import com.orbiscreen.android.player.Idr
import com.orbiscreen.android.player.PlayerHolder
import com.orbiscreen.android.player.StreamEvent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TOKEN_REFRESH_INTERVAL_MS = 30_000L

data class StreamState(
    val host: String,
    val port: Int,
    val event: StreamEvent = StreamEvent.Idle,
    val displayWidth: Int = 1920,
    val displayHeight: Int = 1080,
    val encoder: String = "",
    val version: String = "",
    val keyboardVisible: Boolean = false,
    val scaleMode: Int = 0,
    val resolutionLabel: String = "1920x1080",
)

class StreamViewModel(
    private val context: Context,
    private val prefs: PrefsStore,
    val host: String,
    val port: Int,
) : ViewModel() {

    private val hostApi = HostApi()
    private val playerHolder = PlayerHolder(context, prefs)
    private var inputDispatcher: InputDispatcher? = null
    private var sessionToken: String? = null
    private var displaySessionId: String? = null
    private var lastIdrAtMs = 0L
    private var waitingForKeyframe = false

    private fun scaleModeFromPref(pref: String): Int = when (pref) {
        "fill" -> 3
        "100" -> 4
        else -> 0
    }

    private val _state = MutableStateFlow(
        StreamState(
            host = host,
            port = port,
            event = StreamEvent.Connecting(android.net.Uri.parse("http://$host:$port/stream")),
            scaleMode = scaleModeFromPref(prefs.scaleMode),
        )
    )
    val state: StateFlow<StreamState> = _state.asStateFlow()

    val player get() = playerHolder.player
    val udpPlayer get() = playerHolder.udpPlayer
    val streamStats get() = playerHolder.stats

    fun detectNativeDisplay(): Triple<Int, Int, Int> {
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as? android.view.WindowManager
        val display = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            try {
                context.display ?: windowManager?.defaultDisplay
            } catch (_: Exception) {
                windowManager?.defaultDisplay
            }
        } else {
            @Suppress("DEPRECATION")
            windowManager?.defaultDisplay
        }
        val mode = display?.mode
        val physW = mode?.physicalWidth ?: context.resources.displayMetrics.widthPixels
        val physH = mode?.physicalHeight ?: context.resources.displayMetrics.heightPixels
        val nativeW = maxOf(physW, physH)
        val nativeH = minOf(physW, physH)
        val refreshRate = mode?.refreshRate?.toInt()?.coerceIn(30, 240) ?: 60
        return Triple(nativeW, nativeH, refreshRate)
    }

    private suspend fun freshToken(forceRefresh: Boolean = false): String {
        return withContext(Dispatchers.IO) {
            if (!forceRefresh && !sessionToken.isNullOrBlank()) {
                return@withContext sessionToken!!
            }
            for (attempt in 1..6) {
                val t = hostApi.token(host, port)
                if (!t.isNullOrBlank()) {
                    sessionToken = t
                    inputDispatcher?.updateToken(t)
                    return@withContext t
                }
                if (attempt < 6) delay(250)
            }
            sessionToken.orEmpty()
        }
    }

    init {
        viewModelScope.launch {
            playerHolder.event.collect { ev ->
                _state.value = _state.value.copy(event = ev)
                when (ev) {
                    is StreamEvent.Playing -> waitingForKeyframe = false
                    is StreamEvent.Error -> {
                        waitingForKeyframe = true
                        requestIdr()
                    }
                    is StreamEvent.Connecting, is StreamEvent.Buffering ->
                        waitingForKeyframe = true
                    is StreamEvent.Disconnected, is StreamEvent.Idle ->
                        waitingForKeyframe = false
                    else -> {}
                }
            }
        }
        viewModelScope.launch {
            while (isActive) {
                delay(Idr.DEBOUNCE_MS)
                if (waitingForKeyframe && playerHolder.udpPlayer.value == null) {
                    requestIdr()
                }
            }
        }
        viewModelScope.launch {
            val info = withContext(Dispatchers.IO) {
                var t: String? = null
                var retries = 0
                while (t.isNullOrBlank() && retries < 6) {
                    t = hostApi.token(host, port)
                    if (!t.isNullOrBlank()) break
                    delay(250)
                    retries++
                }
                val i = hostApi.info(host, port)
                t to i
            }
            sessionToken = info.first
            info.first?.let { inputDispatcher?.updateToken(it) }
            val token = info.first.orEmpty()
            val identity = com.orbiscreen.android.net.ClientIdentity.from(context)
            val session = if (token.isNotBlank()) {
                hostApi.openSession(host, port, token, identity)
            } else {
                null
            }
            displaySessionId = session?.id
            inputDispatcher?.sessionId = session?.id
            val hostInfo = info.second
            val (nativeW, nativeH, _) = detectNativeDisplay()
            val isPortrait = context.resources.configuration.orientation ==
                android.content.res.Configuration.ORIENTATION_PORTRAIT
            val targetW = if (isPortrait) nativeH else nativeW
            val targetH = if (isPortrait) nativeW else nativeH
            val w = session?.width
                ?: targetW.takeIf { it > 0 }
                ?: hostInfo?.width
                ?: identity.width
            val h = session?.height
                ?: targetH.takeIf { it > 0 }
                ?: hostInfo?.height
                ?: identity.height
            _state.value = _state.value.copy(
                displayWidth = w,
                displayHeight = h,
                resolutionLabel = "${w}x${h}",
                encoder = session?.encoder ?: hostInfo?.encoder.orEmpty(),
                version = hostInfo?.version.orEmpty(),
            )
            inputDispatcher?.resize(
                _state.value.displayWidth,
                _state.value.displayHeight,
            )
            playerHolder.refreshSession = { reopenDisplaySession() }
            playerHolder.build(
                host,
                port,
                session,
                tokenProvider = { freshToken() },
            )
        }
        viewModelScope.launch {
            _state.collect { s ->
                inputDispatcher?.resize(s.displayWidth, s.displayHeight)
            }
        }
        viewModelScope.launch {
            while (isActive) {
                delay(TOKEN_REFRESH_INTERVAL_MS)
                val t = withContext(Dispatchers.IO) { hostApi.token(host, port) }
                if (!t.isNullOrBlank() && t != sessionToken) {
                    sessionToken = t
                    inputDispatcher?.updateToken(t)
                }
            }
        }
        viewModelScope.launch {
            playerHolder.event.collect { ev ->
                if (ev is StreamEvent.Playing && host != "127.0.0.1" && host != "localhost") {
                    prefs.recentHost = com.orbiscreen.android.data.RecentHost(host = host, port = port)
                }
            }
        }
    }

    private fun requestIdr() {
        waitingForKeyframe = true
        val udp = playerHolder.udpPlayer.value
        if (udp != null) {
            udp.requestIdr()
            return
        }
        val now = android.os.SystemClock.elapsedRealtime()
        if (!Idr.due(now, lastIdrAtMs)) return
        lastIdrAtMs = now
        ensureInput().control("idr")
    }

    fun ensureInput(): InputDispatcher {
        val dispatcher = inputDispatcher ?: InputDispatcher(
            host = state.value.host,
            port = state.value.port,
            displayWidth = state.value.displayWidth,
            displayHeight = state.value.displayHeight,
            token = sessionToken ?: "",
            tokenProvider = { sessionToken ?: "" },
        ).also {
            it.pointerSpeed = prefs.pointerSpeed
            it.onUnauthorized = {
                viewModelScope.launch { freshToken(forceRefresh = true) }
            }
            inputDispatcher = it
        }
        // Session is opened in init before the surface calls ensureInput.
        // Always refresh so /input is not dropped when several displays exist.
        dispatcher.sessionId = displaySessionId
        sessionToken?.let { dispatcher.updateToken(it) }
        dispatcher.resize(state.value.displayWidth, state.value.displayHeight)
        return dispatcher
    }

    val pointerSpeed: Float
        get() = prefs.pointerSpeed

    fun setPointerSpeed(speed: Float) {
        prefs.pointerSpeed = speed
        inputDispatcher?.pointerSpeed = speed
    }

    fun disconnect() {
        val id = displaySessionId
        val token = sessionToken
        displaySessionId = null
        viewModelScope.launch(Dispatchers.IO) {
            if (!id.isNullOrBlank() && !token.isNullOrBlank()) {
                hostApi.closeSession(host, port, token, id)
            }
        }
        playerHolder.release()
    }

    private suspend fun reopenDisplaySession(): com.orbiscreen.android.net.HostApi.SessionInfo? {
        val token = freshToken(forceRefresh = true)
        val identity = com.orbiscreen.android.net.ClientIdentity.from(context)
        val session = if (token.isNotBlank()) {
            hostApi.openSession(host, port, token, identity)
        } else {
            null
        }
        displaySessionId = session?.id
        inputDispatcher?.sessionId = session?.id
        if (session != null) {
            _state.value = _state.value.copy(
                displayWidth = session.width,
                displayHeight = session.height,
                resolutionLabel = "${session.width}x${session.height}",
                encoder = session.encoder,
            )
            inputDispatcher?.resize(session.width, session.height)
        }
        return session
    }

    fun retry() = playerHolder.retry(state.value.host, state.value.port) { freshToken(forceRefresh = true) }

    fun toggleKeyboard() {
        _state.value = _state.value.copy(keyboardVisible = !_state.value.keyboardVisible)
    }

    fun lock() {
        ensureInput().control("lock")
    }

    fun setScaleMode(mode: Int) {
        _state.value = _state.value.copy(scaleMode = mode)
    }

    fun setScaleModeByKey(key: String) {
        prefs.scaleMode = key
        _state.value = _state.value.copy(scaleMode = scaleModeFromPref(key))
    }

    fun updateDimensions(w: Int, h: Int, label: String = "${w}x${h}", fps: Int = 60) {
        if (w > 0 && h > 0) {
            _state.value = _state.value.copy(
                displayWidth = w,
                displayHeight = h,
                resolutionLabel = label,
            )
            inputDispatcher?.resize(w, h)
            ensureInput().control("set_resolution", org.json.JSONObject().apply {
                put("width", w)
                put("height", h)
                put("fps", fps)
                displaySessionId?.let { put("session", it) }
            })
        }
    }

    fun onPause() {
        playerHolder.onAppBackgrounded()
    }

    fun onResume() {
        playerHolder.onAppForegrounded()
    }

    fun ctrlAltDel() {
        ensureInput().control("ctrl_alt_del")
    }

    override fun onCleared() {
        disconnect()
        inputDispatcher?.release()
        super.onCleared()
    }
}

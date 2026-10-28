package com.kothabarta.feature.ludo.local

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class LocalLudoViewModel(
    modeId: String,
    roller: DieRoller = SecureDieRoller(),
    playerCount: Int = 4,
) : ViewModel() {
    private val engine = LocalLudoEngine(roller)
    private val mode = LocalLudoMode.entries.firstOrNull { it.variantId == modeId } ?: LocalLudoMode.CLASSIC
    private val playerNames = (1..playerCount.coerceIn(2, 4)).map { "Player $it" }
    private val _state = MutableStateFlow(engine.newGame(mode, playerNames))
    val state = _state.asStateFlow()
    private val _isRolling = MutableStateFlow(false)
    val isRolling = _isRolling.asStateFlow()
    private val _isDiceRevealAnimating = MutableStateFlow(false)
    val isDiceRevealAnimating = _isDiceRevealAnimating.asStateFlow()
    private val _diceAnimationId = MutableStateFlow(0L)
    val diceAnimationId = _diceAnimationId.asStateFlow()
    private val _isAnimatingMove = MutableStateFlow(false)
    val isAnimatingMove = _isAnimatingMove.asStateFlow()
    private val _selectedTokenId = MutableStateFlow<Int?>(null)
    val selectedTokenId = _selectedTokenId.asStateFlow()
    private val _selectedTokenSeat = MutableStateFlow<Int?>(null)
    val selectedTokenSeat = _selectedTokenSeat.asStateFlow()
    private var lastClaimedDiceAnimationId = 0L
    private var nextDiceAnimationId = 0L
    private var rollingJob: Job? = null

    fun claimDiceAnimation(id: Long): Boolean {
        if (id <= lastClaimedDiceAnimationId) return false
        lastClaimedDiceAnimationId = id
        return true
    }

    fun onRollAnimationFinished(id: Long) {
        if (id == _diceAnimationId.value) _isDiceRevealAnimating.value = false
    }

    fun roll() {
        val current = _state.value
        if (_isRolling.value || _isDiceRevealAnimating.value || _isAnimatingMove.value || current.phase != "ROLL" || current.winnerSeat != null ||
            current.players.none { it.seat == current.turnSeat && it.status == "ACTIVE" }
        ) return
        _isRolling.value = true
        rollingJob = viewModelScope.launch {
            delay(850)
            if (_state.value.phase != "ROLL" || _state.value.turnSeat != current.turnSeat ||
                _state.value.players.none { it.seat == current.turnSeat && it.status == "ACTIVE" }
            ) {
                _isRolling.value = false
                return@launch
            }
            runCatching {
                val next = engine.roll(_state.value)
                val moved = tokensChanged(_state.value, next)
                if (moved) {
                    _isAnimatingMove.value = true
                    _selectedTokenId.value = changedTokenId(_state.value, next)
                    _selectedTokenSeat.value = _state.value.turnSeat
                }
                _state.value = next
                _diceAnimationId.value = ++nextDiceAnimationId
                _isDiceRevealAnimating.value = true
            }.onFailure { _isDiceRevealAnimating.value = false }
            _isRolling.value = false
            rollingJob = null
        }
    }

    fun move(token: Int) {
        val current = _state.value
        if (_isRolling.value || _isDiceRevealAnimating.value || _isAnimatingMove.value || current.phase != "MOVE" || current.legalMoves.none { it.tokenId == token }) return
        _isAnimatingMove.value = true
        _selectedTokenId.value = token
        _selectedTokenSeat.value = current.turnSeat
        runCatching { engine.move(current, token) }.onSuccess { _state.value = it }.onFailure {
            _isAnimatingMove.value = false
            _selectedTokenId.value = null
            _selectedTokenSeat.value = null
        }
    }

    fun onMoveAnimationStateChanged(running: Boolean) {
        _isAnimatingMove.value = running
        if (!running) {
            _selectedTokenId.value = null
            _selectedTokenSeat.value = null
        }
    }

    fun leavePlayer(seat: Int) {
        val current = _state.value
        if (current.players.none { it.seat == seat }) return
        rollingJob?.cancel()
        rollingJob = null
        _isRolling.value = false
        _isDiceRevealAnimating.value = false
        _diceAnimationId.value = 0L
        _isAnimatingMove.value = false
        _selectedTokenId.value = null
        _selectedTokenSeat.value = null
        _state.value = engine.leave(current, seat)
    }

    private fun tokensChanged(before: LocalLudoState, after: LocalLudoState) = before.players.any { old ->
        after.players.firstOrNull { it.seat == old.seat }?.tokens != old.tokens
    }

    private fun changedTokenId(before: LocalLudoState, after: LocalLudoState): Int? = before.players.firstOrNull { it.seat == before.turnSeat }?.tokens
        ?.firstOrNull { old -> after.players.firstOrNull { it.seat == before.turnSeat }?.tokens?.firstOrNull { it.id == old.id }?.position != old.position }?.id
}

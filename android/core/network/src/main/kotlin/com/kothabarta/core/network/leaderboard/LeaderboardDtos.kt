package com.kothabarta.core.network.leaderboard

import com.kothabarta.core.network.social.MediaRefDto

data class RankChangeDto(val direction: String? = null, val delta: Int? = null)

data class LeaderboardRowDto(
    val rank: Int,
    val id: String,
    val fullName: String,
    val avatar: MediaRefDto? = null,
    val currentCity: String? = null,
    val points: Int = 0,
    val quizPoints: Int = 0,
    val gamePoints: Int = 0,
    val correctCount: Int = 0,
    val wrongCount: Int = 0,
    val attempted: Int = 0,
    val rankChange: RankChangeDto? = null,
)

data class NextRankDto(
    val isFirst: Boolean = false,
    val rank: Int? = null,
    val points: Int? = null,
    val pointsNeeded: Int? = null,
)

/** The server spreads the viewer's own [LeaderboardRowDto] fields directly into `me` — duplicated here rather than nested, matching the real (flat) JSON shape. */
data class LeaderboardMeDto(
    val rank: Int,
    val id: String,
    val fullName: String,
    val avatar: MediaRefDto? = null,
    val currentCity: String? = null,
    val points: Int = 0,
    val quizPoints: Int = 0,
    val gamePoints: Int = 0,
    val correctCount: Int = 0,
    val wrongCount: Int = 0,
    val attempted: Int = 0,
    val rankChange: RankChangeDto? = null,
    val inTop20: Boolean = false,
    val nextRank: NextRankDto? = null,
)

data class LeaderboardCycleDto(
    val status: String,
    val label: String? = null,
    val closesAt: String? = null,
    val timezone: String? = null,
    val closedMonthLabel: String? = null,
    val opensAt: String? = null,
)

data class LeaderboardTopResponse(
    val category: String = "overall",
    val period: String = "month",
    val top3: List<LeaderboardRowDto> = emptyList(),
    val top20: List<LeaderboardRowDto> = emptyList(),
    val totalParticipants: Int = 0,
    val participantLabel: String? = null,
    val me: LeaderboardMeDto? = null,
    val cycle: LeaderboardCycleDto? = null,
)

data class StatCategoryDto(val key: String, val label: String, val points: Int = 0)

data class QuizStatsDto(
    val attempted: Int = 0,
    val correct: Int = 0,
    val wrong: Int = 0,
    val correctPercent: Double? = null,
    val wrongPercent: Double? = null,
)

data class UserStatsDto(
    val id: String,
    val fullName: String,
    val avatar: MediaRefDto? = null,
    val currentCity: String? = null,
    val period: String = "month",
    val totalPoints: Int = 0,
    val categories: List<StatCategoryDto> = emptyList(),
    val quiz: QuizStatsDto? = null,
)

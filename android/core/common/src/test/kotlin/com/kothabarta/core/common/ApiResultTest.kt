package com.kothabarta.core.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiResultTest {

    @Test
    fun `map transforms only the success branch`() {
        val success: ApiResult<Int> = ApiResult.Success(2)
        val failure: ApiResult<Int> = ApiResult.Failure(ApiError("SOME_CODE", "nope"))

        assertEquals(ApiResult.Success(4), success.map { it * 2 })
        assertTrue(failure.map { it * 2 } is ApiResult.Failure)
    }

    @Test
    fun `onSuccess and onFailure only fire for their own branch`() {
        var successSeen = false
        var failureSeen: ApiError? = null

        (ApiResult.Success("ok") as ApiResult<String>)
            .onSuccess { successSeen = true }
            .onFailure { failureSeen = it }

        assertTrue(successSeen)
        assertEquals(null, failureSeen)

        val error = ApiError("ACCOUNT_MUTED", "You can't do this right now.")
        successSeen = false
        (ApiResult.Failure(error) as ApiResult<String>)
            .onSuccess { successSeen = true }
            .onFailure { failureSeen = it }

        assertTrue(!successSeen)
        assertEquals(error, failureSeen)
    }
}

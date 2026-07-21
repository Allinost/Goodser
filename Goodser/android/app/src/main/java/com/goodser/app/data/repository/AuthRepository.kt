package com.goodser.app.data.repository

import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*
import com.goodser.app.util.TokenManager

class AuthRepository(private val tokenManager: TokenManager) {
    suspend fun login(username: String, password: String): Result<TokenPair> = runCatching {
        val resp = RetrofitClient.callAuthWithFailover { it.login(LoginRequest(username, password)) }
        if (resp.code == 0 && resp.data != null) {
            tokenManager.saveTokens(resp.data.accessToken, resp.data.refreshToken)
            tokenManager.saveUsername(resp.data.username ?: username)
            resp.data
        } else {
            throw Exception(resp.message ?: "登录失败")
        }
    }

    suspend fun register(username: String, password: String, nickname: String?): Result<TokenPair> = runCatching {
        val resp = RetrofitClient.callAuthWithFailover { it.register(RegisterRequest(username, password, nickname)) }
        if (resp.code == 0 && resp.data != null) {
            tokenManager.saveTokens(resp.data.accessToken, resp.data.refreshToken)
            resp.data
        } else {
            throw Exception(resp.message ?: "注册失败")
        }
    }

    suspend fun getMe(): Result<UserInfo> = runCatching {
        val resp = RetrofitClient.callAuthWithFailover { it.getMe() }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "获取用户信息失败")
    }

    suspend fun logout() {
        runCatching { RetrofitClient.callAuthWithFailover { it.logout() } }
        tokenManager.clear()
    }

    suspend fun isLoggedIn(): Boolean = tokenManager.getAccessToken() != null
}

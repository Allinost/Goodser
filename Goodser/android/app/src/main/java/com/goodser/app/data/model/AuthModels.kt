package com.goodser.app.data.model

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("code") val code: Int,
    @SerializedName("message") val message: String?,
    @SerializedName("data") val data: T?,
    @SerializedName("trace_id") val traceId: String?
)

data class PaginatedResp<T>(
    @SerializedName("items") val items: List<T>,
    @SerializedName("has_more") val hasMore: Boolean,
    @SerializedName("total") val total: Int
)

data class LoginRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String,
    @SerializedName("nickname") val nickname: String? = null
)

data class TokenPair(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("refresh_token") val refreshToken: String,
    @SerializedName("expires_in") val expiresIn: Long?,
    @SerializedName("user_id") val userId: Long?,
    @SerializedName("username") val username: String?
)

data class UserInfo(
    @SerializedName("user_id") val userId: Long?,
    @SerializedName("username") val username: String?,
    @SerializedName("nickname") val nickname: String?,
    @SerializedName("avatar_url") val avatarUrl: String?,
    @SerializedName("email") val email: String?,
    @SerializedName("phone") val phone: String?
)

data class RefreshRequest(
    @SerializedName("refresh_token") val refreshToken: String
)

package com.goodser.app.data.api

import com.goodser.app.data.model.*
import okhttp3.MultipartBody
import retrofit2.http.*

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): ApiResponse<TokenPair>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): ApiResponse<TokenPair>

    @POST("auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): ApiResponse<TokenPair>

    @GET("auth/me")
    suspend fun getMe(): ApiResponse<UserInfo>

    @PUT("auth/profile")
    suspend fun updateProfile(@Body body: Map<String, String>): ApiResponse<Any>

    @POST("auth/logout")
    suspend fun logout(): ApiResponse<Any>
}

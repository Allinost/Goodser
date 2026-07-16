package com.goodser.app.data.model

import com.google.gson.annotations.SerializedName

data class Inventory(
    @SerializedName("_id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("sort_order") val sortOrder: Int = 0,
    @SerializedName("created_at") val createdAt: String = "",
    @SerializedName("updated_at") val updatedAt: String = ""
)

data class CreateInventoryReq(
    @SerializedName("name") val name: String
)

data class UpdateInventoryReq(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String?
)

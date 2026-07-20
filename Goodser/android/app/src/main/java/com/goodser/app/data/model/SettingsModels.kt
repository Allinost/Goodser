package com.goodser.app.data.model

import com.google.gson.annotations.SerializedName

data class GoodserTag(
    @SerializedName("_id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("color") val color: String = "#1890ff",
    @SerializedName("created_at") val createdAt: String = ""
)

data class CreateTagReq(
    @SerializedName("name") val name: String,
    @SerializedName("color") val color: String? = null
)

data class UpdateTagReq(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("color") val color: String? = null
)

data class StatusCode(
    @SerializedName("_id") val id: String,
    @SerializedName("code") val code: String,
    @SerializedName("label") val label: String,
    @SerializedName("is_system") val isSystem: Boolean = false,
    @SerializedName("created_at") val createdAt: String = ""
)

data class AddStatusCodeReq(
    @SerializedName("code") val code: String,
    @SerializedName("label") val label: String
)

data class UpdateStatusCodeReq(
    @SerializedName("id") val id: String,
    @SerializedName("label") val label: String
)

data class IdReq(
    @SerializedName("id") val id: String
)

data class UploadImageResp(
    @SerializedName("url") val url: String
)

data class ServerEntry(
    val id: String = java.util.UUID.randomUUID().toString(),
    val url: String,
    val active: Boolean = true,
    val order: Int = 0
)

data class SyncAllResp(
    @SerializedName("inventories") val inventories: List<Inventory>?,
    @SerializedName("products") val products: Map<String, List<Product>>?,
    @SerializedName("outbound_orders") val outboundOrders: Map<String, List<OutboundOrder>>?,
    @SerializedName("inbound_logs") val inboundLogs: Map<String, List<InboundLog>>?,
    @SerializedName("tags") val tags: List<GoodserTag>?,
    @SerializedName("status_codes") val statusCodes: List<StatusCode>?
)

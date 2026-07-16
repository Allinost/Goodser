package com.goodser.app.data.model

import com.google.gson.annotations.SerializedName

data class OutboundOrder(
    @SerializedName("_id") val id: String,
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String,
    @SerializedName("type") val type: String,
    @SerializedName("status") val status: String,
    @SerializedName("order_info") val orderInfo: String? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("items") val items: List<OrderItem>? = null,
    @SerializedName("source_reserve_id") val sourceReserveId: String? = null,
    @SerializedName("created_at") val createdAt: String = "",
    @SerializedName("updated_at") val updatedAt: String = "",
    @SerializedName("confirmed_at") val confirmedAt: String? = null,
    @SerializedName("cancelled_at") val cancelledAt: String? = null
)

data class OrderItem(
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String,
    @SerializedName("product_code") val productCode: String,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("image_url") val imageUrl: String? = null
)

data class CreateOutboundReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String,
    @SerializedName("type") val type: String? = "outbound",
    @SerializedName("status") val status: String? = null,
    @SerializedName("order_info") val orderInfo: String? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("items") val items: List<OrderItem>,
    @SerializedName("source_reserve_id") val sourceReserveId: String? = null
)

data class ReserveToOutboundReq(
    @SerializedName("id") val id: String,
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String,
    @SerializedName("items") val items: List<OrderItem>,
    @SerializedName("order_info") val orderInfo: String? = null,
    @SerializedName("remark") val remark: String? = null
)

data class PaginatedReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("page") val page: Int = 1,
    @SerializedName("page_size") val pageSize: Int = 20
)

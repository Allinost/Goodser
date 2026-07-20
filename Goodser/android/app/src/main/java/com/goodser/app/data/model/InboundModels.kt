package com.goodser.app.data.model

import com.google.gson.annotations.SerializedName

data class InboundLog(
    @SerializedName("_id") val id: String,
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String? = null,
    @SerializedName("type") val type: String,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("items") val items: List<OrderItem>? = null,
    @SerializedName("created_at") val createdAt: String = ""
)

data class InboundSingleReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String? = null,
    @SerializedName("code") val code: String,
    @SerializedName("main_zone") val mainZone: String,
    @SerializedName("sub_zone") val subZone: String,
    @SerializedName("seq_number") val seqNumber: Int,
    @SerializedName("quantity") val quantity: Int?,
    @SerializedName("status_code") val statusCode: String,
    @SerializedName("name") val name: String,
    @SerializedName("original_price") val originalPrice: Double? = null,
    @SerializedName("market_price") val marketPrice: Double? = null,
    @SerializedName("expected_price") val expectedPrice: Double? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("storage_location") val storageLocation: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("images") val images: List<String>? = null,
    @SerializedName("tags") val tags: List<String>? = null
)

data class InboundBatchReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("items") val items: List<InboundBatchItem>
)

data class InboundBatchItem(
    @SerializedName("code") val code: String,
    @SerializedName("main_zone") val mainZone: String,
    @SerializedName("sub_zone") val subZone: String,
    @SerializedName("seq_number") val seqNumber: Int,
    @SerializedName("quantity") val quantity: Int?,
    @SerializedName("status_code") val statusCode: String,
    @SerializedName("name") val name: String,
    @SerializedName("original_price") val originalPrice: Double? = null,
    @SerializedName("market_price") val marketPrice: Double? = null,
    @SerializedName("expected_price") val expectedPrice: Double? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("storage_location") val storageLocation: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("images") val images: List<String>? = null,
    @SerializedName("tags") val tags: List<String>? = null
)

data class InboundSearchImportReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("items") val items: List<SearchImportItem>
)

data class SearchImportItem(
    @SerializedName("product_id") val productId: String,
    @SerializedName("product_name") val productName: String,
    @SerializedName("product_code") val productCode: String,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("image_url") val imageUrl: String? = null
)

data class InboundBatchResp(
    @SerializedName("items") val items: List<Product>,
    @SerializedName("count") val count: Int
)

data class InboundSearchImportResp(
    @SerializedName("items") val items: List<Product>,
    @SerializedName("count") val count: Int
)

data class CreateInboundLogReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("order_no") val orderNo: String? = null,
    @SerializedName("type") val type: String,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("items") val items: List<OrderItem>
)

data class UpdateInboundLogReq(
    @SerializedName("id") val id: String,
    @SerializedName("order_no") val orderNo: String? = null,
    @SerializedName("type") val type: String? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("items") val items: List<OrderItem>? = null
)

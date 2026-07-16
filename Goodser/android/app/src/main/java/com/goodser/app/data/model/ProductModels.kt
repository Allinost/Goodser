package com.goodser.app.data.model

import com.google.gson.annotations.SerializedName

data class Product(
    @SerializedName("_id") val id: String,
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("code") val code: String,
    @SerializedName("main_zone") val mainZone: String,
    @SerializedName("sub_zone") val subZone: String,
    @SerializedName("seq_number") val seqNumber: Int,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("reserved_quantity") val reservedQuantity: Int = 0,
    @SerializedName("status_code") val statusCode: String,
    @SerializedName("name") val name: String,
    @SerializedName("original_price") val originalPrice: Double? = null,
    @SerializedName("market_price") val marketPrice: Double? = null,
    @SerializedName("expected_price") val expectedPrice: Double? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("storage_location") val storageLocation: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("images") val images: List<String>? = null,
    @SerializedName("tags") val tags: List<String>? = null,
    @SerializedName("created_at") val createdAt: String = "",
    @SerializedName("updated_at") val updatedAt: String = ""
)

data class CreateProductReq(
    @SerializedName("inventory_id") val inventoryId: String,
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
    @SerializedName("tags") val tags: List<String>? = null
)

data class UpdateProductReq(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("main_zone") val mainZone: String? = null,
    @SerializedName("sub_zone") val subZone: String? = null,
    @SerializedName("code") val code: String? = null,
    @SerializedName("seq_number") val seqNumber: Int? = null,
    @SerializedName("quantity") val quantity: Int? = null,
    @SerializedName("status_code") val statusCode: String? = null,
    @SerializedName("original_price") val originalPrice: Double? = null,
    @SerializedName("market_price") val marketPrice: Double? = null,
    @SerializedName("expected_price") val expectedPrice: Double? = null,
    @SerializedName("remark") val remark: String? = null,
    @SerializedName("storage_location") val storageLocation: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("tags") val tags: List<String>? = null
)

data class AllocateSeqReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("main_zone") val mainZone: String,
    @SerializedName("sub_zone") val subZone: String
)

data class AllocateSeqResp(
    @SerializedName("seq_number") val seqNumber: Int
)

data class QueryProductsReq(
    @SerializedName("inventory_id") val inventoryId: String,
    @SerializedName("keyword") val keyword: String? = null,
    @SerializedName("status_code") val statusCode: String? = null,
    @SerializedName("main_zone") val mainZone: String? = null,
    @SerializedName("sub_zone") val subZone: String? = null,
    @SerializedName("tag_id") val tagId: String? = null,
    @SerializedName("page") val page: Int? = 1,
    @SerializedName("page_size") val pageSize: Int? = 20,
    @SerializedName("sort_by") val sortBy: String? = null,
    @SerializedName("sort_order") val sortOrder: String? = null
)

package com.goodser.app.data.api

import com.goodser.app.data.model.*
import com.goodser.app.data.model.GoodserTag
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface GoodserApi {
    // Inventories
    @POST("zzz-goodser/legacy/loadInventories")
    suspend fun loadInventories(): ApiResponse<List<Inventory>>

    @POST("zzz-goodser/legacy/createInventory")
    suspend fun createInventory(@Body req: CreateInventoryReq): ApiResponse<Inventory>

    @POST("zzz-goodser/legacy/updateInventory")
    suspend fun updateInventory(@Body req: UpdateInventoryReq): ApiResponse<Inventory>

    @POST("zzz-goodser/legacy/deleteInventory")
    suspend fun deleteInventory(@Body req: IdReq): ApiResponse<Any>

    // Products
    @POST("zzz-goodser/legacy/loadProducts")
    suspend fun loadProducts(@Body req: PaginatedReq): ApiResponse<PaginatedResp<Product>>

    @POST("zzz-goodser/legacy/queryProducts")
    suspend fun queryProducts(@Body req: QueryProductsReq): ApiResponse<List<Product>>

    @POST("zzz-goodser/legacy/createProduct")
    suspend fun createProduct(@Body req: CreateProductReq): ApiResponse<Product>

    @POST("zzz-goodser/legacy/updateProduct")
    suspend fun updateProductLegacy(@Body req: UpdateProductReq): ApiResponse<Product>

    @POST("zzz-goodser/legacy/deleteProduct")
    suspend fun deleteProduct(@Body req: IdReq): ApiResponse<Any>

    @POST("zzz-goodser/legacy/allocateSeq")
    suspend fun allocateSeq(@Body req: AllocateSeqReq): ApiResponse<AllocateSeqResp>

    // Inbound
    @POST("zzz-goodser/legacy/inboundSingle")
    suspend fun inboundSingle(@Body req: InboundSingleReq): ApiResponse<Product>

    @POST("zzz-goodser/legacy/inboundBatch")
    suspend fun inboundBatch(@Body req: InboundBatchReq): ApiResponse<InboundBatchResp>

    @POST("zzz-goodser/legacy/inboundSearchImport")
    suspend fun inboundSearchImport(@Body req: InboundSearchImportReq): ApiResponse<InboundSearchImportResp>

    @POST("zzz-goodser/legacy/loadInboundLogs")
    suspend fun loadInboundLogs(@Body req: PaginatedReq): ApiResponse<PaginatedResp<InboundLog>>

    @POST("zzz-goodser/legacy/createInboundLog")
    suspend fun createInboundLog(@Body req: CreateInboundLogReq): ApiResponse<InboundLog>

    @POST("zzz-goodser/legacy/updateInboundLog")
    suspend fun updateInboundLog(@Body req: UpdateInboundLogReq): ApiResponse<InboundLog>

    @POST("zzz-goodser/legacy/deleteInboundLog")
    suspend fun deleteInboundLog(@Body req: IdReq): ApiResponse<Any>

    // Outbound
    @POST("zzz-goodser/legacy/loadOutboundOrders")
    suspend fun loadOutboundOrders(@Body req: PaginatedReq): ApiResponse<PaginatedResp<OutboundOrder>>

    @POST("zzz-goodser/legacy/createOutbound")
    suspend fun createOutbound(@Body req: CreateOutboundReq): ApiResponse<OutboundOrder>

    @POST("zzz-goodser/legacy/confirmOutbound")
    suspend fun confirmOutbound(@Body req: IdReq): ApiResponse<OutboundOrder>

    @POST("zzz-goodser/legacy/cancelOutbound")
    suspend fun cancelOutbound(@Body req: IdReq): ApiResponse<OutboundOrder>

    @POST("zzz-goodser/legacy/cancelReserve")
    suspend fun cancelReserve(@Body req: IdReq): ApiResponse<OutboundOrder>

    @POST("zzz-goodser/legacy/reserveToOutbound")
    suspend fun reserveToOutbound(@Body req: ReserveToOutboundReq): ApiResponse<OutboundOrder>

    // Tags
    @POST("zzz-goodser/legacy/loadTags")
    suspend fun loadTags(): ApiResponse<List<GoodserTag>>

    @POST("zzz-goodser/legacy/createTag")
    suspend fun createTag(@Body req: CreateTagReq): ApiResponse<GoodserTag>

    @POST("zzz-goodser/legacy/updateTag")
    suspend fun updateTagLegacy(@Body req: UpdateTagReq): ApiResponse<GoodserTag>

    @POST("zzz-goodser/legacy/deleteTag")
    suspend fun deleteTag(@Body req: IdReq): ApiResponse<Any>

    // Status Codes
    @POST("zzz-goodser/legacy/loadStatusCodes")
    suspend fun loadStatusCodes(): ApiResponse<List<StatusCode>>

    @POST("zzz-goodser/legacy/addStatusCode")
    suspend fun addStatusCode(@Body req: AddStatusCodeReq): ApiResponse<StatusCode>

    @POST("zzz-goodser/legacy/updateStatusCode")
    suspend fun updateStatusCode(@Body req: UpdateStatusCodeReq): ApiResponse<StatusCode>

    @POST("zzz-goodser/legacy/removeStatusCode")
    suspend fun removeStatusCode(@Body req: IdReq): ApiResponse<Any>

    // Image
    @Multipart
    @POST("zzz-goodser/legacy/uploadImage")
    suspend fun uploadImage(@Part image: MultipartBody.Part): ApiResponse<UploadImageResp>

    // Sync
    @POST("zzz-goodser/syncAll")
    suspend fun syncAll(): ApiResponse<SyncAllResp>
}

package com.goodser.app.data.repository

import android.content.Context
import android.net.Uri
import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class ProductRepository {
    suspend fun loadProducts(inventoryId: String, page: Int = 1, pageSize: Int = 20): Result<PaginatedResp<Product>> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.loadProducts(PaginatedReq(inventoryId, page, pageSize)) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "加载商品失败")
    }

    suspend fun queryProducts(req: QueryProductsReq): Result<List<Product>> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.queryProducts(req) }
        if (resp.code == 0 && resp.data != null) resp.data.items
        else throw Exception(resp.message ?: "搜索商品失败")
    }

    suspend fun create(req: CreateProductReq): Result<Product> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.createProduct(req) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "创建商品失败")
    }

    suspend fun update(req: UpdateProductReq): Result<Product> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.updateProductLegacy(req) }
        if (resp.code == 0 && resp.data != null) resp.data
        else throw Exception(resp.message ?: "更新商品失败")
    }

    suspend fun delete(id: String): Result<Unit> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.deleteProduct(IdReq(id)) }
        if (resp.code != 0) throw Exception(resp.message ?: "删除商品失败")
    }

    suspend fun allocateSeq(inventoryId: String, mainZone: String, subZone: String): Result<Int> = runCatching {
        val resp = RetrofitClient.callWithFailover { it.allocateSeq(AllocateSeqReq(inventoryId, mainZone, subZone)) }
        if (resp.code == 0 && resp.data != null) resp.data.seqNumber
        else throw Exception(resp.message ?: "分配序号失败")
    }

    suspend fun uploadImage(context: Context, imageUri: Uri): Result<String> = runCatching {
        val inputStream = context.contentResolver.openInputStream(imageUri)
            ?: throw Exception("无法读取图片")
        val bytes = inputStream.readBytes().also { inputStream.close() }
        val name = "upload_${System.currentTimeMillis()}.jpg"
        val requestBody = bytes.toRequestBody("image/jpeg".toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("image", name, requestBody)
        val resp = RetrofitClient.callWithFailover { it.uploadImage(part) }
        if (resp.code == 0 && resp.data != null) resp.data.url
        else throw Exception(resp.message ?: "上传图片失败")
    }
}

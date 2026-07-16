package com.goodser.app.ui.inventory

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class ProductDetailUiState(
    val product: Product? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val deleted: Boolean = false,
    val updated: Boolean = false,
    val editing: Boolean = false,
    val editName: String = "",
    val editStatusCode: String = "",
    val editQuantity: String = "",
    val editOriginalPrice: String = "",
    val editMarketPrice: String = "",
    val editExpectedPrice: String = "",
    val editStorageLocation: String = "",
    val editRemark: String = "",
    val uploadingImage: Boolean = false
)

class ProductDetailViewModel : ViewModel() {
    private val productRepo = ProductRepository()
    private val _state = MutableStateFlow(ProductDetailUiState())
    val state: StateFlow<ProductDetailUiState> = _state

    fun loadProduct(id: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
        }
    }

    fun setProduct(product: Product) {
        _state.value = _state.value.copy(
            product = product, loading = false,
            editName = product.name, editStatusCode = product.statusCode,
            editQuantity = product.quantity.toString(),
            editOriginalPrice = product.originalPrice?.toString() ?: "",
            editMarketPrice = product.marketPrice?.toString() ?: "",
            editExpectedPrice = product.expectedPrice?.toString() ?: "",
            editStorageLocation = product.storageLocation ?: "",
            editRemark = product.remark ?: ""
        )
    }

    fun toggleEdit() {
        val p = _state.value.product ?: return
        if (_state.value.editing) {
            _state.value = _state.value.copy(editing = false,
                editName = p.name, editStatusCode = p.statusCode,
                editQuantity = p.quantity.toString(),
                editOriginalPrice = p.originalPrice?.toString() ?: "",
                editMarketPrice = p.marketPrice?.toString() ?: "",
                editExpectedPrice = p.expectedPrice?.toString() ?: "",
                editStorageLocation = p.storageLocation ?: "",
                editRemark = p.remark ?: ""
            )
        } else {
            _state.value = _state.value.copy(editing = true)
        }
    }

    fun updateField(field: String, value: String) {
        _state.value = when (field) {
            "name" -> _state.value.copy(editName = value)
            "statusCode" -> _state.value.copy(editStatusCode = value)
            "quantity" -> _state.value.copy(editQuantity = value.filter { it.isDigit() })
            "originalPrice" -> _state.value.copy(editOriginalPrice = value)
            "marketPrice" -> _state.value.copy(editMarketPrice = value)
            "expectedPrice" -> _state.value.copy(editExpectedPrice = value)
            "storageLocation" -> _state.value.copy(editStorageLocation = value)
            "remark" -> _state.value.copy(editRemark = value)
            else -> _state.value
        }
    }

    fun saveEdit() {
        val p = _state.value.product ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val req = UpdateProductReq(
                id = p.id,
                name = _state.value.editName.takeIf { it != p.name },
                statusCode = _state.value.editStatusCode.takeIf { it != p.statusCode },
                quantity = _state.value.editQuantity.toIntOrNull().takeIf { it != p.quantity },
                originalPrice = _state.value.editOriginalPrice.toDoubleOrNull().takeIf { it != p.originalPrice },
                marketPrice = _state.value.editMarketPrice.toDoubleOrNull().takeIf { it != p.marketPrice },
                expectedPrice = _state.value.editExpectedPrice.toDoubleOrNull().takeIf { it != p.expectedPrice },
                storageLocation = _state.value.editStorageLocation.takeIf { it != (p.storageLocation ?: "") },
                remark = _state.value.editRemark.takeIf { it != (p.remark ?: "") }
            )
            productRepo.update(req).fold(
                onSuccess = { product ->
                    _state.value = _state.value.copy(product = product, editing = false, loading = false, updated = true)
                    setProduct(product)
                },
                onFailure = { _state.value = _state.value.copy(loading = false, error = it.message) }
            )
        }
    }

    fun uploadImage(context: Context, uri: Uri) {
        viewModelScope.launch {
            _state.value = _state.value.copy(uploadingImage = true, error = null)
            productRepo.uploadImage(context, uri).fold(
                onSuccess = { url ->
                    val p = _state.value.product ?: return@launch
                    productRepo.update(UpdateProductReq(id = p.id, imageUrl = url)).fold(
                        onSuccess = { product ->
                            _state.value = _state.value.copy(product = product, uploadingImage = false)
                        },
                        onFailure = { _state.value = _state.value.copy(uploadingImage = false, error = it.message) }
                    )
                },
                onFailure = { _state.value = _state.value.copy(uploadingImage = false, error = it.message) }
            )
        }
    }

    fun deleteProduct(id: String) {
        viewModelScope.launch {
            productRepo.delete(id).fold(
                onSuccess = { _state.value = _state.value.copy(deleted = true) },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }
}

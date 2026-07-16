package com.goodser.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.goodser.app.data.model.Inventory
import com.goodser.app.data.repository.InventoryRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class AppUiState(
    val inventories: List<Inventory> = emptyList(),
    val currentInventory: Inventory? = null,
    val loading: Boolean = false,
    val error: String? = null
)

class AppViewModel : ViewModel() {
    private val inventoryRepo = InventoryRepository()
    private val _state = MutableStateFlow(AppUiState())
    val state: StateFlow<AppUiState> = _state

    fun loadInventories() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            inventoryRepo.loadInventories().fold(
                onSuccess = { list ->
                    val current = _state.value.currentInventory
                    val newCurrent = if (current != null && list.any { it.id == current.id }) {
                        current
                    } else {
                        list.firstOrNull()
                    }
                    _state.value = _state.value.copy(inventories = list, currentInventory = newCurrent, loading = false)
                },
                onFailure = { _state.value = _state.value.copy(loading = false, error = it.message) }
            )
        }
    }

    fun selectInventory(inventory: Inventory) {
        _state.value = _state.value.copy(currentInventory = inventory)
    }

    fun createInventory(name: String) {
        viewModelScope.launch {
            inventoryRepo.create(name).fold(
                onSuccess = { loadInventories() },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }

    fun deleteInventory(id: String) {
        viewModelScope.launch {
            inventoryRepo.delete(id).fold(
                onSuccess = { loadInventories() },
                onFailure = { _state.value = _state.value.copy(error = it.message) }
            )
        }
    }

    fun clearError() { _state.value = _state.value.copy(error = null) }
}

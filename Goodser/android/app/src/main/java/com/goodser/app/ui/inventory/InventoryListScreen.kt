package com.goodser.app.ui.inventory

import androidx.compose.foundation.layout.ExperimentalLayoutApi

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.goodser.app.data.model.GoodserTag
import com.goodser.app.ui.AppViewModel
import com.goodser.app.ui.SyncEventBus
import com.goodser.app.ui.components.*
import com.goodser.app.ui.theme.*

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)

@Composable
fun InventoryListScreen(
    appViewModel: AppViewModel,
    onProductClick: (String) -> Unit,
    viewModel: InventoryListViewModel = viewModel()
) {
    val appState by appViewModel.state.collectAsState()
    val state by viewModel.state.collectAsState()
    var showCreateDialog by remember { mutableStateOf(false) }
    var showRenameDialog by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var showInventoryPicker by remember { mutableStateOf(false) }
    var showFilterSheet by remember { mutableStateOf(false) }
    var sortBy by remember { mutableStateOf<String?>(null) }
    var sortOrder by remember { mutableStateOf<String?>(null) }
    var pullRefreshKey by remember { mutableIntStateOf(0) }
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) {
        SyncEventBus.events.collect { pullRefreshKey++; viewModel.search() }
    }

    LaunchedEffect(appState.currentInventory?.id) {
        appState.currentInventory?.let { inv ->
            viewModel.selectInventory(inv)
        }
    }

    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
            .collect { lastVisible ->
                val total = listState.layoutInfo.totalItemsCount
                if (lastVisible != null && lastVisible >= total - 3) {
                    viewModel.loadMore()
                }
            }
    }

    Column(modifier = Modifier.fillMaxSize().background(Background).windowInsetsPadding(WindowInsets.statusBars)) {
        Surface(shadowElevation = 2.dp) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = Color(0xFFF5F5F5),
                        onClick = { showInventoryPicker = true }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                appState.currentInventory?.name ?: "选择库存",
                                fontSize = 14.sp,
                                color = OnBackground,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(Modifier.width(4.dp))
                            Text("▼", fontSize = 10.sp, color = TextSecondary)
                        }
                    }
                    TextButton(onClick = { showRenameDialog = true }, modifier = Modifier.height(32.dp)) {
                        Text("重命名", fontSize = 12.sp, color = TextSecondary)
                    }
                    TextButton(onClick = { showDeleteConfirm = true }, modifier = Modifier.height(32.dp)) {
                        Text("删除", fontSize = 12.sp, color = Error)
                    }
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = { viewModel.search() }) {
                        Icon(Icons.Default.Refresh, "刷新", tint = TextSecondary, modifier = Modifier.size(20.dp))
                    }
                    IconButton(onClick = { showCreateDialog = true }) {
                        Icon(Icons.Default.Add, "新建", tint = TextSecondary, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }

        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Spacer(Modifier.height(8.dp))
            SearchBar(
                query = state.query,
                onQueryChange = { viewModel.setQuery(it) },
                onSearch = { viewModel.search() }
            )
            Spacer(Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "共 ${state.totalCount} 件商品，当前显示 ${state.products.size} 件",
                    fontSize = 12.sp,
                    color = TextSecondary,
                    modifier = Modifier.weight(1f)
                )
                val totalStock = state.products.sumOf { it.quantity + it.reservedQuantity }
                Text("总库存 $totalStock", fontSize = 12.sp, color = Primary, fontWeight = FontWeight.Medium)
            }

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    SortChip("默认", active = sortBy == null, onClick = { sortBy = null; sortOrder = null })
                    SortChip(
                        "编码${if (sortBy == "code") if (sortOrder == "asc") "↑" else "↓" else ""}",
                        active = sortBy == "code",
                        onClick = {
                            if (sortBy == "code" && sortOrder == "asc") { sortBy = "code"; sortOrder = "desc" }
                            else { sortBy = "code"; sortOrder = "asc" }
                        }
                    )
                    SortChip(
                        "名称${if (sortBy == "name") if (sortOrder == "asc") "↑" else "↓" else ""}",
                        active = sortBy == "name",
                        onClick = {
                            if (sortBy == "name" && sortOrder == "asc") { sortBy = "name"; sortOrder = "desc" }
                            else { sortBy = "name"; sortOrder = "asc" }
                        }
                    )
                    SortChip(
                        "数量${if (sortBy == "quantity") if (sortOrder == "asc") "↑" else "↓" else ""}",
                        active = sortBy == "quantity",
                        onClick = {
                            if (sortBy == "quantity" && sortOrder == "asc") { sortBy = "quantity"; sortOrder = "desc" }
                            else { sortBy = "quantity"; sortOrder = "asc" }
                        }
                    )
                    SortChip(
                        "价格${if (sortBy == "expected_price") if (sortOrder == "asc") "↑" else "↓" else ""}",
                        active = sortBy == "expected_price",
                        onClick = {
                            if (sortBy == "expected_price" && sortOrder == "asc") { sortBy = "expected_price"; sortOrder = "desc" }
                            else { sortBy = "expected_price"; sortOrder = "asc" }
                        }
                    )
                }
                Spacer(Modifier.width(4.dp))
                val hasFilter = state.selectedZone != null || state.selectedStatusCode != null || state.selectedTagId != null
                IconButton(onClick = { showFilterSheet = true }, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.Default.FilterList, "筛选", tint = if (hasFilter) Primary else TextSecondary, modifier = Modifier.size(20.dp))
                }
            }
        }

        PullRefreshBox(
            refreshing = state.loading,
            onRefresh = { viewModel.search() },
            modifier = Modifier.fillMaxSize()
        ) {
            if (state.loading && state.products.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else if (state.products.isEmpty()) {
                EmptyState(
                    icon = "📦",
                    title = if (state.query.isNotBlank() || state.selectedZone != null) "未匹配商品" else "暂无商品",
                    description = if (state.query.isBlank() && state.selectedZone == null) "点击右上角 + 新建商品来添加" else null
                )
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(vertical = 8.dp)
                ) {
                    items(state.products, key = { it.id }) { product ->
                        ProductCard(product = product, onClick = { onProductClick(product.id) })
                    }
                    if (state.hasMore) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showInventoryPicker) {
        ModalBottomSheet(onDismissRequest = { showInventoryPicker = false }) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("选择库存", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = OnBackground)
                Spacer(Modifier.height(12.dp))
                appState.inventories.forEach { inv ->
                    Row(
                        modifier = Modifier.fillMaxWidth()
                            .clickable {
                                appViewModel.selectInventory(inv)
                                showInventoryPicker = false
                            }
                            .padding(vertical = 12.dp, horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(inv.name, fontSize = 14.sp, color = OnBackground, modifier = Modifier.weight(1f))
                        if (inv.id == appState.currentInventory?.id) {
                            Text("✓", color = Primary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    HorizontalDivider(color = Divider)
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }

    if (showFilterSheet) {
        ModalBottomSheet(onDismissRequest = { showFilterSheet = false }) {
            FilterSheet(
                zones = state.availableZones,
                statusCodes = state.availableStatusCodes,
                tags = state.availableTags,
                selectedZone = state.selectedZone,
                selectedStatusCode = state.selectedStatusCode,
                selectedTagId = state.selectedTagId,
                onZoneChange = { viewModel.setZoneFilter(it) },
                onStatusCodeChange = { viewModel.setStatusCodeFilter(it) },
                onTagChange = { viewModel.setTagFilter(it) },
                onReset = { viewModel.clearFilters() },
                onConfirm = { showFilterSheet = false }
            )
        }
    }

    if (showCreateDialog) {
        InputDialog(
            title = "新建库存目录",
            placeholder = "目录名称",
            onConfirm = { appViewModel.createInventory(it); showCreateDialog = false },
            onDismiss = { showCreateDialog = false }
        )
    }

    val currentInv = appState.currentInventory
    if (showRenameDialog && currentInv != null) {
        InputDialog(
            title = "重命名目录",
            initialValue = currentInv.name,
            placeholder = "新名称",
            onConfirm = { appViewModel.renameInventory(currentInv.id, it); showRenameDialog = false },
            onDismiss = { showRenameDialog = false }
        )
    }

    if (showDeleteConfirm && currentInv != null) {
        ConfirmDialog(
            title = "删除目录",
            message = "确认删除 ${currentInv.name}？此操作不可恢复。",
            confirmText = "删除",
            onConfirm = { appViewModel.deleteInventory(currentInv.id); showDeleteConfirm = false },
            onDismiss = { showDeleteConfirm = false },
            isDestructive = true
        )
    }
}

@Composable
fun SortChip(text: String, active: Boolean, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = if (active) TagBlueBg else Surface,
        onClick = onClick
    ) {
        Text(
            text = text,
            fontSize = 12.sp,
            color = if (active) TagBlueText else TextSecondary,
            fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FilterSheet(
    zones: List<String>,
    statusCodes: List<String>,
    tags: List<GoodserTag>,
    selectedZone: String?,
    selectedStatusCode: String?,
    selectedTagId: String?,
    onZoneChange: (String?) -> Unit,
    onStatusCodeChange: (String?) -> Unit,
    onTagChange: (String?) -> Unit,
    onReset: () -> Unit,
    onConfirm: () -> Unit
) {
    Column(modifier = Modifier.padding(16.dp)) {
        Text("筛选", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = OnBackground)
        Spacer(Modifier.height(16.dp))

        if (zones.isNotEmpty()) {
            Text("主分区", fontSize = 13.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterTagChip("全部", active = selectedZone == null, onClick = { onZoneChange(null) })
                zones.forEach { zone ->
                    FilterTagChip(zone, active = selectedZone == zone, onClick = { onZoneChange(if (selectedZone == zone) null else zone) })
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        if (statusCodes.isNotEmpty()) {
            Text("状态", fontSize = 13.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterTagChip("全部", active = selectedStatusCode == null, onClick = { onStatusCodeChange(null) })
                statusCodes.forEach { code ->
                    FilterTagChip(code, active = selectedStatusCode == code, onClick = { onStatusCodeChange(if (selectedStatusCode == code) null else code) })
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        if (tags.isNotEmpty()) {
            Text("标签", fontSize = 13.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterTagChip("全部", active = selectedTagId == null, onClick = { onTagChange(null) })
                tags.forEach { tag ->
                    FilterTagChip(tag.name, active = selectedTagId == tag.id, onClick = { onTagChange(if (selectedTagId == tag.id) null else tag.id) })
                }
            }
        }

        Spacer(Modifier.height(24.dp))
        HorizontalDivider(color = Divider)
        Spacer(Modifier.height(12.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(
                onClick = onReset,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("重置", color = TextSecondary)
            }
            Button(
                onClick = onConfirm,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("确认筛选", color = OnPrimary)
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
fun FilterTagChip(text: String, active: Boolean, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = if (active) TagBlueBg else Color(0xFFF5F5F5),
        onClick = onClick
    ) {
        Text(
            text = text,
            fontSize = 12.sp,
            color = if (active) TagBlueText else TextSecondary,
            fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
        )
    }
}

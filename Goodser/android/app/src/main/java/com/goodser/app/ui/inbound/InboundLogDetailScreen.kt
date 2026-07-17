package com.goodser.app.ui.inbound

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.*
import com.goodser.app.ui.components.ConfirmDialog
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

private fun typeLabel(type: String): String = when (type) {
    "single" -> "单品入库"
    "batch" -> "批量入库"
    "search" -> "搜索导入"
    else -> type
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboundLogDetailScreen(
    logId: String,
    currentInventoryId: String,
    onBack: () -> Unit,
    onProductClick: (String) -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    val repo = remember { InboundRepository() }
    val inventoryRepo = remember { InventoryRepository() }
    val productRepo = remember { ProductRepository() }

    var log by remember { mutableStateOf<InboundLog?>(null) }
    var inventories by remember { mutableStateOf<List<Inventory>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showEditSheet by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deleted by remember { mutableStateOf(false) }

    LaunchedEffect(logId, currentInventoryId) {
        loading = true
        inventoryRepo.loadInventories().fold(onSuccess = { inventories = it }, onFailure = {})
        repo.loadLogs(currentInventoryId).fold(
            onSuccess = { resp -> log = resp.items.find { it.id == logId }; loading = false },
            onFailure = { error = it.message; loading = false }
        )
    }
    LaunchedEffect(deleted) { if (deleted) onBack() }

    val inventoryName = log?.let { l -> inventories.find { it.id == l.inventoryId }?.name ?: "未知目录" } ?: ""

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("入库单详情") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary)
            )
        },
        bottomBar = {
            if (log != null) {
                Surface(shadowElevation = 8.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showDeleteConfirm = true },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Error)
                        ) {
                            Icon(Icons.Default.Delete, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("删除")
                        }
                        Button(
                            onClick = { showEditSheet = true },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Primary)
                        ) {
                            Icon(Icons.Default.Edit, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("编辑")
                        }
                    }
                }
            }
        }
    ) { padding ->
        if (loading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else if (log == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text(if (error != null) error!! else "入库单不存在", color = TextSecondary)
            }
        } else {
            val inboundLog = log!!
            val items = inboundLog.items ?: emptyList()
            val totalQty = items.sumOf { it.quantity }

            Column(
                modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).background(Background).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(shape = RoundedCornerShape(4.dp), color = TagBlueBg) {
                                Text(typeLabel(inboundLog.type), fontSize = 12.sp, color = TagBlueText, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                            }
                            Spacer(Modifier.width(8.dp))
                            inboundLog.orderNo?.let { no ->
                                Surface(shape = RoundedCornerShape(4.dp), color = TagGreenBg) {
                                    Text(no, fontSize = 12.sp, color = TagGreenText, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                                }
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Text("入库目录: $inventoryName", fontSize = 14.sp, color = TextPrimary)
                        Spacer(Modifier.height(4.dp))
                        Text("创建时间: ${inboundLog.createdAt.take(19)}", fontSize = 13.sp, color = TextSecondary)
                        if (!inboundLog.remark.isNullOrBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text("备注: ${inboundLog.remark}", fontSize = 13.sp, color = TextSecondary)
                        }
                    }
                }

                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("入库商品", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Spacer(Modifier.height(8.dp))
                        if (items.isEmpty()) {
                            Text("暂无商品", fontSize = 13.sp, color = TextSecondary)
                        } else {
                            items.forEachIndexed { idx, item ->
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable { onProductClick(item.productId) }) {
                                    if (!item.imageUrl.isNullOrBlank()) {
                                        AsyncImage(model = item.imageUrl, contentDescription = null, modifier = Modifier.size(44.dp).clip(RoundedCornerShape(6.dp)), contentScale = ContentScale.Crop)
                                        Spacer(Modifier.width(10.dp))
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(item.productName, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text(item.productCode, fontSize = 12.sp, color = TextSecondary)
                                    }
                                    Text("+${item.quantity}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Success)
                                }
                                if (idx < items.size - 1) HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 2.dp))
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Surface(shape = RoundedCornerShape(6.dp), color = TagGrayBg) {
                            Text("共 ${items.size} 种商品，合计 $totalQty 件", fontSize = 13.sp, color = TextSecondary, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
                        }
                    }
                }

                Spacer(Modifier.height(80.dp))
            }
        }
    }

    if (showDeleteConfirm && log != null) {
        ConfirmDialog(
            title = "删除入库单",
            message = "确定删除此入库单？此操作不可恢复。",
            confirmText = "删除",
            onConfirm = {
                showDeleteConfirm = false
                scope.launch {
                    repo.deleteLog(log!!.id).fold(
                        onSuccess = { deleted = true },
                        onFailure = { error = it.message }
                    )
                }
            },
            onDismiss = { showDeleteConfirm = false },
            isDestructive = true
        )
    }

    if (showEditSheet && log != null) {
        EditLogSheet(
            log = log!!,
            inventoryId = currentInventoryId,
            productRepo = productRepo,
            repo = repo,
            onDismiss = { showEditSheet = false },
            onSaved = { updatedLog ->
                showEditSheet = false
                log = updatedLog
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditLogSheet(
    log: InboundLog,
    inventoryId: String,
    productRepo: ProductRepository,
    repo: InboundRepository,
    onDismiss: () -> Unit,
    onSaved: (InboundLog) -> Unit
) {
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var editItems by remember { mutableStateOf(log.items ?: emptyList()) }
    var editRemark by remember { mutableStateOf(log.remark ?: "") }
    var searchQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<Product>>(emptyList()) }
    var searched by remember { mutableStateOf(false) }
    var searchLoading by remember { mutableStateOf(false) }
    var selectedSearchIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var saving by remember { mutableStateOf(false) }
    var editError by remember { mutableStateOf<String?>(null) }

    fun doSearch() {
        if (inventoryId.isBlank()) return
        scope.launch {
            searchLoading = true; searched = true
            productRepo.queryProducts(QueryProductsReq(inventoryId = inventoryId, keyword = searchQuery.ifBlank { null })).fold(
                onSuccess = { searchResults = it; searchLoading = false },
                onFailure = { editError = it.message; searchLoading = false }
            )
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("编辑入库单", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary, modifier = Modifier.weight(1f))
                IconButton(onClick = onDismiss) { Icon(Icons.Default.Close, "关闭", tint = TextSecondary) }
            }

            Spacer(Modifier.height(16.dp))

            Text("追加商品", fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    placeholder = { Text("搜索商品名称或编码") }
                )
                Spacer(Modifier.width(8.dp))
                IconButton(onClick = { doSearch() }) { Icon(Icons.Default.Search, "搜索", tint = Primary) }
            }

            if (searchLoading) {
                Spacer(Modifier.height(8.dp))
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(modifier = Modifier.size(20.dp)) }
            } else if (searched && searchResults.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                searchResults.forEach { product ->
                    val alreadyAdded = editItems.any { it.productId == product.id }
                    Row(
                        modifier = Modifier.fillMaxWidth().clickable {
                            if (!alreadyAdded) {
                                selectedSearchIds = if (product.id in selectedSearchIds) selectedSearchIds - product.id else selectedSearchIds + product.id
                            }
                        }.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (!product.imageUrl.isNullOrBlank()) {
                            AsyncImage(model = product.imageUrl, contentDescription = null, modifier = Modifier.size(40.dp).clip(RoundedCornerShape(4.dp)), contentScale = ContentScale.Crop)
                            Spacer(Modifier.width(8.dp))
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(product.name, fontSize = 14.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                            Text(product.code, fontSize = 12.sp, color = TextSecondary)
                        }
                        if (alreadyAdded) {
                            Text("已添加", fontSize = 12.sp, color = Success)
                        } else {
                            Checkbox(checked = product.id in selectedSearchIds, onCheckedChange = {
                                selectedSearchIds = if (product.id in selectedSearchIds) selectedSearchIds - product.id else selectedSearchIds + product.id
                            }, colors = CheckboxDefaults.colors(checkedColor = Primary))
                        }
                    }
                }
                if (selectedSearchIds.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = {
                            val toAdd = searchResults.filter { it.id in selectedSearchIds }.map { p ->
                                OrderItem(productId = p.id, productName = p.name, productCode = p.code, quantity = 1, imageUrl = p.imageUrl)
                            }
                            editItems = editItems + toAdd
                            selectedSearchIds = emptySet()
                            searchQuery = ""; searchResults = emptyList(); searched = false
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) { Text("确认添加 (${selectedSearchIds.size})") }
                }
            } else if (searched && searchResults.isEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text("未找到商品", fontSize = 13.sp, color = TextSecondary)
            }

            HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 16.dp))

            Text("已选商品", fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary)
            Spacer(Modifier.height(8.dp))

            if (editItems.isEmpty()) {
                Text("暂无商品", fontSize = 13.sp, color = TextSecondary)
            } else {
                editItems.forEachIndexed { idx, item ->
                    var qty by remember(item.productId) { mutableStateOf(item.quantity.toString()) }
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.productName, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(item.productCode, fontSize = 12.sp, color = TextSecondary)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(
                                onClick = {
                                    val newQty = (qty.toIntOrNull() ?: 1) - 1
                                    if (newQty > 0) { qty = newQty.toString(); editItems = editItems.toMutableList().also { it[idx] = it[idx].copy(quantity = newQty) } }
                                },
                                modifier = Modifier.size(28.dp)
                            ) { Icon(Icons.Default.Remove, "减少", modifier = Modifier.size(18.dp), tint = TextSecondary) }
                            OutlinedTextField(
                                value = qty,
                                onValueChange = {
                                    qty = it.filter { c -> c.isDigit() }
                                    val nv = qty.toIntOrNull() ?: 1
                                    editItems = editItems.toMutableList().also { it[idx] = it[idx].copy(quantity = nv) }
                                },
                                modifier = Modifier.width(56.dp),
                                singleLine = true,
                                textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, textAlign = TextAlign.Center),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                            )
                            IconButton(
                                onClick = {
                                    val newQty = (qty.toIntOrNull() ?: 1) + 1
                                    qty = newQty.toString()
                                    editItems = editItems.toMutableList().also { it[idx] = it[idx].copy(quantity = newQty) }
                                },
                                modifier = Modifier.size(28.dp)
                            ) { Icon(Icons.Default.Add, "增加", modifier = Modifier.size(18.dp), tint = Primary) }
                        }
                        IconButton(onClick = { editItems = editItems.toMutableList().also { it.removeAt(idx) } }) {
                            Icon(Icons.Default.Close, "移除", tint = Error, modifier = Modifier.size(18.dp))
                        }
                    }
                    if (idx < editItems.size - 1) HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 2.dp))
                }
            }

            Spacer(Modifier.height(12.dp))

            OutlinedTextField(
                value = editRemark,
                onValueChange = { editRemark = it },
                label = { Text("备注") },
                minLines = 2,
                maxLines = 4,
                modifier = Modifier.fillMaxWidth()
            )

            if (editError != null) { Spacer(Modifier.height(8.dp)); Text(editError!!, color = Error, fontSize = 13.sp) }

            Spacer(Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                ) { Text("取消", color = TextSecondary) }
                Button(
                    onClick = {
                        scope.launch {
                            saving = true; editError = null
                            repo.updateLog(UpdateInboundLogReq(
                                id = log.id,
                                orderNo = log.orderNo,
                                type = log.type,
                                remark = editRemark.ifBlank { null },
                                items = editItems.ifEmpty { null }
                            )).fold(
                                onSuccess = { updated -> saving = false; onSaved(updated) },
                                onFailure = { editError = it.message; saving = false }
                            )
                        }
                    },
                    enabled = !saving,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                ) {
                    if (saving) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnPrimary, strokeWidth = 2.dp)
                    else Text("保存", color = OnPrimary)
                }
            }
        }
    }
}

package com.goodser.app.ui.inbound

import androidx.compose.foundation.layout.ExperimentalLayoutApi

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.*
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

private val ZONES = listOf("A", "B", "C", "D", "E", "F", "G", "H")
private val TAG_COLORS = listOf(
    "#1890ff", "#52c41a", "#fa8c16", "#ff4d4f",
    "#722ed1", "#13c2c2", "#eb2f96", "#faad14",
    "#2f54eb", "#a0d911", "#f5222d", "#fa541c"
)

private fun parseTagColor(hex: String): Color {
    return try {
        val clean = hex.removePrefix("#")
        val argb = if (clean.length == 6) "FF$clean" else clean
        Color(argb.toLong(16))
    } catch (_: Exception) {
        TagBlueText
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)

@Composable
fun InboundSearchScreen(
    currentInventoryId: String,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val inventoryRepo = remember { InventoryRepository() }
    val productRepo = remember { ProductRepository() }
    val tagRepo = remember { TagRepository() }
    val statusCodeRepo = remember { StatusCodeRepository() }
    val inboundRepo = remember { InboundRepository() }

    var inventories by remember { mutableStateOf<List<Inventory>>(emptyList()) }
    var selectedInventoryId by remember { mutableStateOf(currentInventoryId) }
    var query by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<Product>>(emptyList()) }
    var searched by remember { mutableStateOf(false) }
    var isMultiSelect by remember { mutableStateOf(false) }
    var selectedProductIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var singleSelectedProduct by remember { mutableStateOf<Product?>(null) }
    var multiSelectedProducts by remember { mutableStateOf<List<Product>>(emptyList()) }
    var singleQty by remember { mutableStateOf("") }
    var singleStatusCode by remember { mutableStateOf("A") }
    var multiStatusCode by remember { mutableStateOf("A") }
    var multiUpdateZone by remember { mutableStateOf(false) }
    var multiMainZone by remember { mutableStateOf("A") }
    var multiSubZone by remember { mutableStateOf("A") }
    var availableTags by remember { mutableStateOf<List<GoodserTag>>(emptyList()) }
    var statusCodes by remember { mutableStateOf<List<StatusCode>>(emptyList()) }
    var selectedTagIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var loading by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf(false) }
    var inventoryExpanded by remember { mutableStateOf(false) }
    var showNewTagDialog by remember { mutableStateOf(false) }

    var singleStatusExpanded by remember { mutableStateOf(false) }
    var multiStatusExpanded by remember { mutableStateOf(false) }
    var multiMainZoneExpanded by remember { mutableStateOf(false) }
    var multiSubZoneExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        inventoryRepo.loadInventories().fold(onSuccess = { inventories = it }, onFailure = {})
        tagRepo.loadTags().fold(onSuccess = { availableTags = it }, onFailure = {})
        statusCodeRepo.loadStatusCodes().fold(onSuccess = { statusCodes = it }, onFailure = {})
    }
    LaunchedEffect(success) { if (success) onBack() }

    val selectedInventoryName = inventories.find { it.id == selectedInventoryId }?.name ?: "未选择"

    val multiSelectedProductsList = if (isMultiSelect) searchResults.filter { it.id in selectedProductIds } else emptyList()
    val multiQtyInputs = remember { mutableStateMapOf<String, String>() }

    fun buildItems(): List<SearchImportItem> {
        if (isMultiSelect) {
            return multiSelectedProductsList.map { p ->
                SearchImportItem(
                    productId = p.id,
                    productName = p.name,
                    productCode = p.code,
                    quantity = multiQtyInputs[p.id]?.toIntOrNull() ?: 1,
                    imageUrl = p.imageUrl
                )
            }
        }
        val sp = singleSelectedProduct ?: return emptyList()
        return listOf(SearchImportItem(
            productId = sp.id,
            productName = sp.name,
            productCode = sp.code,
            quantity = singleQty.toIntOrNull() ?: 1,
            imageUrl = sp.imageUrl
        ))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("入库搜索") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary)
            )
        },
        bottomBar = {
            val hasSelection = if (isMultiSelect) multiSelectedProductsList.isNotEmpty() else singleSelectedProduct != null
            if (hasSelection) {
                Surface(shadowElevation = 8.dp) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        if (error != null) { Text(error!!, color = Error, fontSize = 13.sp); Spacer(Modifier.height(8.dp)) }
                        Button(
                            onClick = {
                                scope.launch {
                                    submitting = true; error = null
                                    inboundRepo.searchImport(InboundSearchImportReq(
                                        inventoryId = selectedInventoryId,
                                        items = buildItems()
                                    )).fold(
                                        onSuccess = { submitting = false; success = true },
                                        onFailure = { submitting = false; error = it.message }
                                    )
                                }
                            },
                            enabled = !submitting && selectedInventoryId.isNotBlank(),
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            if (submitting) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnPrimary)
                            else Text("确认导入入库", fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).background(Background)
        ) {
            Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("入库目录", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Spacer(Modifier.height(8.dp))
                        ExposedDropdownMenuBox(expanded = inventoryExpanded, onExpandedChange = { inventoryExpanded = it }) {
                            OutlinedTextField(
                                value = selectedInventoryName,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("请选择入库目录 *") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = inventoryExpanded) },
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                singleLine = true
                            )
                            ExposedDropdownMenu(expanded = inventoryExpanded, onDismissRequest = { inventoryExpanded = false }) {
                                inventories.forEach { inv ->
                                    DropdownMenuItem(text = { Text(inv.name, fontSize = 14.sp) }, onClick = { selectedInventoryId = inv.id; inventoryExpanded = false })
                                }
                            }
                        }
                    }
                }

                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("搜索商品", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Spacer(Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = query,
                                onValueChange = { query = it },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                placeholder = { Text("搜索商品名称或编码") }
                            )
                            Spacer(Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    if (selectedInventoryId.isBlank()) return@Button
                                    scope.launch {
                                        loading = true; searched = true
                                        productRepo.queryProducts(QueryProductsReq(inventoryId = selectedInventoryId, keyword = query.ifBlank { null })).fold(
                                            onSuccess = { searchResults = it; loading = false },
                                            onFailure = { error = it.message; loading = false }
                                        )
                                    }
                                },
                                enabled = !loading
                            ) { Text("搜索", fontSize = 13.sp) }
                        }

                        if (loading) {
                            Spacer(Modifier.height(16.dp))
                            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(modifier = Modifier.size(24.dp)) }
                        } else if (searched && searchResults.isEmpty()) {
                            Spacer(Modifier.height(24.dp))
                            Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("🔍", fontSize = 36.sp, color = TextSecondary)
                                Spacer(Modifier.height(8.dp))
                                Text("未找到商品", color = TextSecondary, fontSize = 14.sp)
                            }
                        } else if (searchResults.isNotEmpty()) {
                            Spacer(Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("搜索结果: ${searchResults.size} 个", fontSize = 13.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                                if (!isMultiSelect) {
                                    TextButton(onClick = { isMultiSelect = true; selectedProductIds = emptySet() }) {
                                        Text("多选", color = Primary, fontSize = 13.sp)
                                    }
                                } else {
                                    TextButton(onClick = { isMultiSelect = false; selectedProductIds = emptySet(); singleSelectedProduct = null }) {
                                        Text("取消多选", color = Primary, fontSize = 13.sp)
                                    }
                                }
                            }
                            Spacer(Modifier.height(4.dp))
                            searchResults.forEach { product ->
                                SearchResultItem(
                                    product = product,
                                    isMultiSelect = isMultiSelect,
                                    isSelected = if (isMultiSelect) product.id in selectedProductIds else singleSelectedProduct?.id == product.id,
                                    onToggle = {
                                        if (isMultiSelect) {
                                            selectedProductIds = if (product.id in selectedProductIds) selectedProductIds - product.id else selectedProductIds + product.id
                                            multiQtyInputs[product.id] = multiQtyInputs[product.id] ?: "1"
                                        } else {
                                            singleSelectedProduct = if (singleSelectedProduct?.id == product.id) null else product
                                            singleQty = "1"
                                            singleStatusCode = product.statusCode
                                        }
                                    }
                                )
                            }
                        } else if (!searched) {
                            Spacer(Modifier.height(24.dp))
                            Text("输入关键词搜索商品", color = TextSecondary, fontSize = 14.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                        }
                    }
                }

                if (isMultiSelect && multiSelectedProductsList.isNotEmpty()) {
                    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("已选 ${multiSelectedProductsList.size} 个商品", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                            Spacer(Modifier.height(8.dp))
                            multiSelectedProductsList.forEach { p ->
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(p.name, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary)
                                        Text("${p.code} | 库存: ${p.quantity}", fontSize = 12.sp, color = TextSecondary)
                                    }
                                    OutlinedTextField(
                                        value = multiQtyInputs[p.id] ?: "1",
                                        onValueChange = { multiQtyInputs[p.id] = it.filter { c -> c.isDigit() } },
                                        modifier = Modifier.width(70.dp),
                                        singleLine = true,
                                        placeholder = { Text("数量") },
                                        textStyle = LocalTextStyle.current.copy(fontSize = 13.sp, textAlign = TextAlign.Center)
                                    )
                                    IconButton(onClick = { selectedProductIds = selectedProductIds - p.id; multiQtyInputs.remove(p.id) }) {
                                        Icon(Icons.Default.Close, "移除", tint = Error, modifier = Modifier.size(18.dp))
                                    }
                                }
                                HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 2.dp))
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("修改已选商品的区域", fontSize = 13.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                                Switch(checked = multiUpdateZone, onCheckedChange = { multiUpdateZone = it })
                            }
                            if (multiUpdateZone) {
                                Spacer(Modifier.height(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    ExposedDropdownMenuBox(expanded = multiMainZoneExpanded, onExpandedChange = { multiMainZoneExpanded = it }, modifier = Modifier.weight(1f)) {
                                        OutlinedTextField(value = multiMainZone, onValueChange = {}, readOnly = true, label = { Text("主分区") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = multiMainZoneExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), singleLine = true)
                                        ExposedDropdownMenu(expanded = multiMainZoneExpanded, onDismissRequest = { multiMainZoneExpanded = false }) {
                                            ZONES.forEach { z -> DropdownMenuItem(text = { Text(z) }, onClick = { multiMainZone = z; multiMainZoneExpanded = false }) }
                                        }
                                    }
                                    ExposedDropdownMenuBox(expanded = multiSubZoneExpanded, onExpandedChange = { multiSubZoneExpanded = it }, modifier = Modifier.weight(1f)) {
                                        OutlinedTextField(value = multiSubZone, onValueChange = {}, readOnly = true, label = { Text("子分区") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = multiSubZoneExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), singleLine = true)
                                        ExposedDropdownMenu(expanded = multiSubZoneExpanded, onDismissRequest = { multiSubZoneExpanded = false }) {
                                            ZONES.forEach { z -> DropdownMenuItem(text = { Text(z) }, onClick = { multiSubZone = z; multiSubZoneExpanded = false }) }
                                        }
                                    }
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                            ExposedDropdownMenuBox(expanded = multiStatusExpanded, onExpandedChange = { multiStatusExpanded = it }) {
                                OutlinedTextField(value = statusCodes.find { it.code == multiStatusCode }?.let { "${it.code} - ${it.label}" } ?: multiStatusCode, onValueChange = {}, readOnly = true, label = { Text("状态编码") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = multiStatusExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), singleLine = true)
                                ExposedDropdownMenu(expanded = multiStatusExpanded, onDismissRequest = { multiStatusExpanded = false }) {
                                    statusCodes.forEach { sc -> DropdownMenuItem(text = { Text("${sc.code} - ${sc.label}", fontSize = 14.sp) }, onClick = { multiStatusCode = sc.code; multiStatusExpanded = false }) }
                                }
                            }
                        }
                    }
                }

                val ssp = singleSelectedProduct
                if (!isMultiSelect && ssp != null) {
                    val product = ssp
                    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (!product.imageUrl.isNullOrBlank()) {
                                    AsyncImage(model = product.imageUrl, contentDescription = null, modifier = Modifier.size(56.dp).clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
                                    Spacer(Modifier.width(12.dp))
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(product.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                                    Text(product.code, fontSize = 12.sp, color = TextSecondary)
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                            OutlinedTextField(value = singleQty, onValueChange = { singleQty = it.filter { c -> c.isDigit() } }, label = { Text("导入数量 *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            Spacer(Modifier.height(8.dp))
                            Text("沿用分区: 沿用原分区 (${product.mainZone}-${product.subZone})", fontSize = 13.sp, color = TextSecondary)
                            Spacer(Modifier.height(8.dp))
                            ExposedDropdownMenuBox(expanded = singleStatusExpanded, onExpandedChange = { singleStatusExpanded = it }) {
                                OutlinedTextField(value = statusCodes.find { it.code == singleStatusCode }?.let { "${it.code} - ${it.label}" } ?: singleStatusCode, onValueChange = {}, readOnly = true, label = { Text("状态编码") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = singleStatusExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), singleLine = true)
                                ExposedDropdownMenu(expanded = singleStatusExpanded, onDismissRequest = { singleStatusExpanded = false }) {
                                    statusCodes.forEach { sc -> DropdownMenuItem(text = { Text("${sc.code} - ${sc.label}", fontSize = 14.sp) }, onClick = { singleStatusCode = sc.code; singleStatusExpanded = false }) }
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("商品标签", fontWeight = FontWeight.Medium, fontSize = 13.sp, color = TextPrimary, modifier = Modifier.weight(1f))
                                TextButton(onClick = { showNewTagDialog = true }) {
                                    Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp), tint = Primary)
                                    Spacer(Modifier.width(2.dp)); Text("新建", fontSize = 13.sp, color = Primary)
                                }
                            }
                            Spacer(Modifier.height(4.dp))
                            if (availableTags.isEmpty()) {
                                Text("暂无标签", fontSize = 13.sp, color = TextSecondary)
                            } else {
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    availableTags.forEach { tag ->
                                        val isSelected = tag.id in selectedTagIds
                                        val tagColor = parseTagColor(tag.color)
                                        Surface(shape = RoundedCornerShape(16.dp), color = if (isSelected) tagColor.copy(alpha = 0.1f) else TagGrayBg, onClick = { selectedTagIds = if (isSelected) selectedTagIds - tag.id else selectedTagIds + tag.id }) {
                                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
                                                Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(if (isSelected) tagColor else TagGrayText))
                                                Spacer(Modifier.width(6.dp))
                                                Text(tag.name, fontSize = 12.sp, color = if (isSelected) tagColor else TextSecondary, fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(80.dp))
            }
        }
    }

    if (showNewTagDialog) {
        NewTagSearchDialog(
            tagRepo = tagRepo,
            onCreated = { tag ->
                showNewTagDialog = false
                selectedTagIds = selectedTagIds + tag.id
            },
            onDismiss = { showNewTagDialog = false }
        )
    }
}

@Composable
private fun SearchResultItem(
    product: Product,
    isMultiSelect: Boolean,
    isSelected: Boolean,
    onToggle: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = if (isSelected) PrimaryLight else Surface,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (!product.imageUrl.isNullOrBlank()) {
                AsyncImage(model = product.imageUrl, contentDescription = null, modifier = Modifier.size(48.dp).clip(RoundedCornerShape(6.dp)), contentScale = ContentScale.Crop)
                Spacer(Modifier.width(10.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(product.name, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary)
                Text(product.code, fontSize = 12.sp, color = TextSecondary)
                Text("当前库存: ${product.quantity}", fontSize = 12.sp, color = TextSecondary)
            }
            if (isMultiSelect) {
                Checkbox(checked = isSelected, onCheckedChange = { onToggle() }, colors = CheckboxDefaults.colors(checkedColor = Primary))
            } else {
                if (isSelected) {
                    Text("✓", color = Primary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewTagSearchDialog(
    tagRepo: TagRepository,
    onCreated: (GoodserTag) -> Unit,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("#1890ff") }

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(12.dp),
        title = { Text("新建标签", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("标签名称") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(12.dp))
                Text("选择颜色", fontSize = 13.sp, color = TextSecondary)
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    TAG_COLORS.forEach { hex ->
                        val isSelected = color == hex
                        Box(modifier = Modifier.size(32.dp).clip(CircleShape).background(parseTagColor(hex)).clickable { color = hex }, contentAlignment = Alignment.Center) {
                            if (isSelected) Text("✓", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (name.isNotBlank()) {
                        scope.launch {
                            tagRepo.create(name, color).fold(
                                onSuccess = { onCreated(it) },
                                onFailure = {}
                            )
                        }
                    }
                },
                enabled = name.isNotBlank()
            ) { Text("创建", color = Primary) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消", color = TextSecondary) } }
    )
}

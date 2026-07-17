package com.goodser.app.ui.inbound

import androidx.compose.foundation.layout.ExperimentalLayoutApi

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
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
fun InboundBatchScreen(
    currentInventoryId: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val inventoryRepo = remember { InventoryRepository() }
    val productRepo = remember { ProductRepository() }
    val tagRepo = remember { TagRepository() }
    val statusCodeRepo = remember { StatusCodeRepository() }
    val repo = remember { InboundRepository() }

    var inventories by remember { mutableStateOf<List<Inventory>>(emptyList()) }
    var selectedInventoryId by remember { mutableStateOf(currentInventoryId) }
    var items by remember { mutableStateOf<List<InboundBatchItem>>(emptyList()) }
    var availableTags by remember { mutableStateOf<List<GoodserTag>>(emptyList()) }
    var statusCodes by remember { mutableStateOf<List<StatusCode>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf(false) }
    var inventoryExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        inventoryRepo.loadInventories().fold(onSuccess = { inventories = it }, onFailure = {})
        tagRepo.loadTags().fold(onSuccess = { availableTags = it }, onFailure = {})
        statusCodeRepo.loadStatusCodes().fold(onSuccess = { statusCodes = it }, onFailure = {})
    }
    LaunchedEffect(success) { if (success) onBack() }

    val selectedInventoryName = inventories.find { it.id == selectedInventoryId }?.name ?: "请选择"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("批量入库") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary)
            )
        },
        bottomBar = {
            if (items.isNotEmpty()) {
                Surface(shadowElevation = 8.dp) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        if (error != null) { Text(error!!, color = Error, fontSize = 13.sp); Spacer(Modifier.height(8.dp)) }
                        Button(
                            onClick = {
                                scope.launch {
                                    loading = true; error = null
                                    repo.batch(InboundBatchReq(inventoryId = selectedInventoryId, items = items)).fold(
                                        onSuccess = { loading = false; success = true },
                                        onFailure = { loading = false; error = it.message }
                                    )
                                }
                            },
                            enabled = !loading && selectedInventoryId.isNotBlank(),
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnPrimary)
                            else Text("确认批量入库 (${items.size}件)", fontWeight = FontWeight.Medium)
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
                                    DropdownMenuItem(
                                        text = { Text(inv.name, fontSize = 14.sp) },
                                        onClick = { selectedInventoryId = inv.id; inventoryExpanded = false }
                                    )
                                }
                            }
                        }
                    }
                }

                if (items.isNotEmpty()) {
                    Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("已添加 ${items.size} 件商品", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary, modifier = Modifier.weight(1f))
                            }
                            Spacer(Modifier.height(8.dp))
                            items.forEachIndexed { index, item ->
                                BatchItemRow(
                                    index = index + 1,
                                    item = item,
                                    tags = availableTags,
                                    onDelete = { items = items.toMutableList().also { it.removeAt(index) } }
                                )
                                if (index < items.size - 1) HorizontalDivider(color = Divider, modifier = Modifier.padding(vertical = 2.dp))
                            }
                        }
                    }
                }

                Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
                    BatchAddForm(
                        inventoryId = selectedInventoryId,
                        availableTags = availableTags,
                        statusCodes = statusCodes,
                        productRepo = productRepo,
                        tagRepo = tagRepo,
                        onAdd = { items = items + it }
                    )
                }

                Spacer(Modifier.height(80.dp))
            }
        }
    }
}

@Composable
private fun BatchItemRow(index: Int, item: InboundBatchItem, tags: List<GoodserTag>, onDelete: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("$index.", fontWeight = FontWeight.Medium, fontSize = 13.sp, color = TextSecondary, modifier = Modifier.width(24.dp))
            if (!item.imageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = item.imageUrl,
                    contentDescription = null,
                    modifier = Modifier.size(44.dp).clip(RoundedCornerShape(6.dp)),
                    contentScale = ContentScale.Crop
                )
                Spacer(Modifier.width(8.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(item.name, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = TextPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text("${item.mainZone}-${item.subZone} | 数量: ${item.quantity ?: 0} | ${item.statusCode}", fontSize = 12.sp, color = TextSecondary)
                val itemTags = item.tags?.mapNotNull { tid -> tags.find { it.id == tid } }
                if (!itemTags.isNullOrEmpty()) {
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        itemTags.forEach { tag ->
                            Surface(shape = RoundedCornerShape(4.dp), color = parseTagColor(tag.color).copy(alpha = 0.1f)) {
                                Text(tag.name, fontSize = 11.sp, color = parseTagColor(tag.color), fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                    }
                }
            }
            TextButton(onClick = onDelete) { Text("删除", color = Error, fontSize = 13.sp) }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)

@Composable
private fun BatchAddForm(
    inventoryId: String,
    availableTags: List<GoodserTag>,
    statusCodes: List<StatusCode>,
    productRepo: ProductRepository,
    tagRepo: TagRepository,
    onAdd: (InboundBatchItem) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var originalPrice by remember { mutableStateOf("") }
    var marketPrice by remember { mutableStateOf("") }
    var expectedPrice by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf("") }
    var storageLocation by remember { mutableStateOf("") }
    var remark by remember { mutableStateOf("") }
    var imageUrls by remember { mutableStateOf<List<String>>(emptyList()) }
    var mainZone by remember { mutableStateOf("A") }
    var subZone by remember { mutableStateOf("A") }
    var statusCode by remember { mutableStateOf("A") }
    var selectedTagIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var uploading by remember { mutableStateOf(false) }
    var showNewTagDialog by remember { mutableStateOf(false) }

    var mainZoneExpanded by remember { mutableStateOf(false) }
    var subZoneExpanded by remember { mutableStateOf(false) }
    var statusCodeExpanded by remember { mutableStateOf(false) }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            scope.launch {
                uploading = true
                productRepo.uploadImage(context, it).fold(
                    onSuccess = { url -> imageUrls = imageUrls + url; uploading = false },
                    onFailure = { e -> formError = e.message; uploading = false }
                )
            }
        }
    }

    Column(modifier = Modifier.padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("添加商品", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary, modifier = Modifier.weight(1f))
        }

        Spacer(Modifier.height(12.dp))

        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("商品名称 *") }, singleLine = true, modifier = Modifier.fillMaxWidth())

        Spacer(Modifier.height(8.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(value = originalPrice, onValueChange = { originalPrice = it }, label = { Text("原价") }, singleLine = true, modifier = Modifier.weight(1f), prefix = { Text("¥") })
            OutlinedTextField(value = marketPrice, onValueChange = { marketPrice = it }, label = { Text("市场价") }, singleLine = true, modifier = Modifier.weight(1f), prefix = { Text("¥") })
        }

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(value = expectedPrice, onValueChange = { expectedPrice = it }, label = { Text("预期出售价") }, singleLine = true, modifier = Modifier.fillMaxWidth(), prefix = { Text("¥") })

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(value = quantity, onValueChange = { quantity = it.filter { c -> c.isDigit() } }, label = { Text("库存数量 *") }, singleLine = true, modifier = Modifier.fillMaxWidth())

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(value = storageLocation, onValueChange = { storageLocation = it }, label = { Text("仓储位置") }, placeholder = { Text("如: A区-1架-2层") }, singleLine = true, modifier = Modifier.fillMaxWidth())

        Spacer(Modifier.height(8.dp))

        OutlinedTextField(value = remark, onValueChange = { remark = it }, label = { Text("备注信息") }, minLines = 2, maxLines = 4, modifier = Modifier.fillMaxWidth())

        Spacer(Modifier.height(12.dp))

        Text("商品图片", fontWeight = FontWeight.Medium, fontSize = 13.sp, color = TextPrimary)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            imageUrls.forEachIndexed { idx, url ->
                Box(modifier = Modifier.size(80.dp)) {
                    AsyncImage(model = url, contentDescription = null, modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
                    Box(modifier = Modifier.align(Alignment.TopEnd).size(20.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.5f)).clickable { imageUrls = imageUrls.toMutableList().also { it.removeAt(idx) } }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Close, "移除", tint = Color.White, modifier = Modifier.size(14.dp))
                    }
                }
            }
            if (imageUrls.size < 9) {
                Box(modifier = Modifier.size(80.dp).clip(RoundedCornerShape(8.dp)).border(1.dp, Divider, RoundedCornerShape(8.dp)).clickable { if (!uploading) imagePicker.launch("image/*") }, contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        if (uploading) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        else { Icon(Icons.Default.PhotoCamera, null, tint = TextSecondary, modifier = Modifier.size(24.dp)); Text("添加图片", fontSize = 10.sp, color = TextSecondary) }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            ExposedDropdownMenuBox(expanded = mainZoneExpanded, onExpandedChange = { mainZoneExpanded = it }, modifier = Modifier.weight(1f)) {
                OutlinedTextField(value = mainZone, onValueChange = {}, readOnly = true, label = { Text("主分区 *") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mainZoneExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), singleLine = true)
                ExposedDropdownMenu(expanded = mainZoneExpanded, onDismissRequest = { mainZoneExpanded = false }) {
                    ZONES.forEach { zone -> DropdownMenuItem(text = { Text(zone) }, onClick = { mainZone = zone; mainZoneExpanded = false }) }
                }
            }
            ExposedDropdownMenuBox(expanded = subZoneExpanded, onExpandedChange = { subZoneExpanded = it }, modifier = Modifier.weight(1f)) {
                OutlinedTextField(value = subZone, onValueChange = {}, readOnly = true, label = { Text("子分区 *") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = subZoneExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), singleLine = true)
                ExposedDropdownMenu(expanded = subZoneExpanded, onDismissRequest = { subZoneExpanded = false }) {
                    ZONES.forEach { zone -> DropdownMenuItem(text = { Text(zone) }, onClick = { subZone = zone; subZoneExpanded = false }) }
                }
            }
            ExposedDropdownMenuBox(expanded = statusCodeExpanded, onExpandedChange = { statusCodeExpanded = it }, modifier = Modifier.weight(1f)) {
                OutlinedTextField(value = statusCodes.find { it.code == statusCode }?.let { "${it.code}" } ?: statusCode, onValueChange = {}, readOnly = true, label = { Text("状态 *") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusCodeExpanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(), singleLine = true)
                ExposedDropdownMenu(expanded = statusCodeExpanded, onDismissRequest = { statusCodeExpanded = false }) {
                    statusCodes.forEach { sc -> DropdownMenuItem(text = { Text("${sc.code} - ${sc.label}", fontSize = 14.sp) }, onClick = { statusCode = sc.code; statusCodeExpanded = false }) }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("商品标签", fontWeight = FontWeight.Medium, fontSize = 13.sp, color = TextPrimary, modifier = Modifier.weight(1f))
            TextButton(onClick = { showNewTagDialog = true }) {
                Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp), tint = Primary)
                Spacer(Modifier.width(2.dp))
                Text("新建", fontSize = 13.sp, color = Primary)
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
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (isSelected) tagColor.copy(alpha = 0.1f) else TagGrayBg,
                        onClick = { selectedTagIds = if (isSelected) selectedTagIds - tag.id else selectedTagIds + tag.id }
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)) {
                            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(if (isSelected) tagColor else TagGrayText))
                            Spacer(Modifier.width(6.dp))
                            Text(tag.name, fontSize = 12.sp, color = if (isSelected) tagColor else TextSecondary, fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal)
                        }
                    }
                }
            }
        }

        if (formError != null) { Spacer(Modifier.height(8.dp)); Text(formError!!, color = Error, fontSize = 13.sp) }

        Spacer(Modifier.height(12.dp))

        OutlinedButton(
            onClick = {
                if (name.isBlank()) { formError = "请输入商品名称"; return@OutlinedButton }
                val qty = quantity.toIntOrNull()
                if (qty == null || qty <= 0) { formError = "请输入有效数量"; return@OutlinedButton }
                if (inventoryId.isBlank()) { formError = "请选择入库目录"; return@OutlinedButton }
                formError = null
                scope.launch {
                    productRepo.allocateSeq(inventoryId, mainZone, subZone).fold(
                        onSuccess = { seq ->
                            onAdd(InboundBatchItem(
                                code = "$mainZone$subZone-${seq.toString().padStart(4, '0')}",
                                mainZone = mainZone, subZone = subZone, seqNumber = seq,
                                quantity = qty, statusCode = statusCode, name = name,
                                originalPrice = originalPrice.toDoubleOrNull(), marketPrice = marketPrice.toDoubleOrNull(),
                                expectedPrice = expectedPrice.toDoubleOrNull(), remark = remark.ifBlank { null },
                                storageLocation = storageLocation.ifBlank { null },
                                imageUrl = imageUrls.firstOrNull(), tags = selectedTagIds.toList().ifEmpty { null }
                            ))
                            name = ""; originalPrice = ""; marketPrice = ""; expectedPrice = ""
                            quantity = ""; storageLocation = ""; remark = ""
                            imageUrls = emptyList(); selectedTagIds = emptySet()
                            mainZone = "A"; subZone = "A"; statusCode = "A"
                        },
                        onFailure = { formError = it.message }
                    )
                }
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp)
        ) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(4.dp))
            Text("+ 添加到列表", fontSize = 14.sp)
        }
    }

    if (showNewTagDialog) {
        NewTagDialog(
            tagRepo = tagRepo,
            onCreated = { tag ->
                showNewTagDialog = false
                selectedTagIds = selectedTagIds + tag.id
            },
            onDismiss = { showNewTagDialog = false }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewTagDialog(
    tagRepo: TagRepository,
    onCreated: (GoodserTag) -> Unit,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("#1890ff") }
    var creating by remember { mutableStateOf(false) }

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
                        creating = true
                        scope.launch {
                            tagRepo.create(name, color).fold(
                                onSuccess = { onCreated(it) },
                                onFailure = { creating = false }
                            )
                        }
                    }
                },
                enabled = name.isNotBlank() && !creating
            ) { Text("创建", color = Primary) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消", color = TextSecondary) } }
    )
}

package com.goodser.app.ui.inventory

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
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.*
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)

@Composable
fun ProductEditScreen(
    productId: String?,
    currentInventoryId: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val productRepo = remember { ProductRepository() }
    val tagRepo = remember { TagRepository() }
    val statusCodeRepo = remember { StatusCodeRepository() }
    val inboundRepo = remember { InboundRepository() }

    var name by remember { mutableStateOf("") }
    var originalPrice by remember { mutableStateOf("") }
    var marketPrice by remember { mutableStateOf("") }
    var expectedPrice by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf("") }
    var storageLocation by remember { mutableStateOf("") }
    var remark by remember { mutableStateOf("") }
    var mainZone by remember { mutableStateOf("") }
    var subZone by remember { mutableStateOf("") }
    var statusCode by remember { mutableStateOf("A") }
    var imageUrls by remember { mutableStateOf<List<String>>(emptyList()) }
    var selectedTagIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var availableZones by remember { mutableStateOf<List<String>>(emptyList()) }
    var availableSubZones by remember { mutableStateOf<List<String>>(emptyList()) }
    var statusCodes by remember { mutableStateOf<List<StatusCode>>(emptyList()) }
    var allTags by remember { mutableStateOf<List<GoodserTag>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var showNewTagDialog by remember { mutableStateOf(false) }
    var newTagName by remember { mutableStateOf("") }
    var newTagColor by remember { mutableStateOf("#1890ff") }

    var mainZoneExpanded by remember { mutableStateOf(false) }
    var subZoneExpanded by remember { mutableStateOf(false) }
    var statusExpanded by remember { mutableStateOf(false) }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            scope.launch {
                loading = true
                error = null
                productRepo.uploadImage(context, it).fold(
                    onSuccess = { url -> imageUrls = imageUrls + url; loading = false },
                    onFailure = { e -> error = e.message; loading = false }
                )
            }
        }
    }

    val isEditing = productId != null

    LaunchedEffect(currentInventoryId) {
        tagRepo.loadTags().fold(onSuccess = { allTags = it }, onFailure = {})
        statusCodeRepo.loadStatusCodes().fold(onSuccess = { statusCodes = it }, onFailure = {})
        productRepo.queryProducts(QueryProductsReq(inventoryId = currentInventoryId, pageSize = 200)).fold(
            onSuccess = { products ->
                availableZones = products.map { it.mainZone }.distinct().sorted()
                availableSubZones = products.map { it.subZone }.distinct().sorted()
            },
            onFailure = {}
        )
    }

    LaunchedEffect(productId, currentInventoryId) {
        if (productId != null) {
            loading = true
            productRepo.queryProducts(QueryProductsReq(inventoryId = currentInventoryId, pageSize = 200)).fold(
                onSuccess = { products ->
                    products.find { it.id == productId }?.let { p ->
                        name = p.name
                        originalPrice = p.originalPrice?.toString() ?: ""
                        marketPrice = p.marketPrice?.toString() ?: ""
                        expectedPrice = p.expectedPrice?.toString() ?: ""
                        quantity = p.quantity.toString()
                        storageLocation = p.storageLocation ?: ""
                        remark = p.remark ?: ""
                        mainZone = p.mainZone
                        subZone = p.subZone
                        statusCode = p.statusCode
                        imageUrls = (p.images ?: p.imageUrl?.let { listOf(it) } ?: emptyList())
                        selectedTagIds = (p.tags ?: emptyList()).toSet()
                    }
                    loading = false
                },
                onFailure = { e -> error = e.message; loading = false }
            )
        }
    }

    val codePreview = buildString {
        if (mainZone.isNotBlank()) {
            append(mainZone)
            append(subZone)
            append("-")
            if (isEditing) {
                append(productId?.let { "____" } ?: "____")
            } else {
                append("____")
            }
        }
    }

    val saveEnabled = name.isNotBlank() && quantity.isNotBlank() && mainZone.isNotBlank() && subZone.isNotBlank()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEditing) "编辑商品" else "新建商品") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Primary, titleContentColor = OnPrimary,
                    navigationIconContentColor = OnPrimary
                )
            )
        }
    ) { padding ->
        if (loading && isEditing) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .background(Background)
            ) {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    modifier = Modifier.fillMaxWidth().padding(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("商品图片", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = OnBackground)
                        Spacer(Modifier.height(12.dp))
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            imageUrls.forEachIndexed { index, url ->
                                Box(modifier = Modifier.size(80.dp)) {
                                    AsyncImage(
                                        model = url,
                                        contentDescription = null,
                                        modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .size(20.dp)
                                            .clip(CircleShape)
                                            .background(Color.Black.copy(alpha = 0.5f))
                                            .clickable { imageUrls = imageUrls.toMutableList().also { it.removeAt(index) } },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Close, "移除", tint = Color.White, modifier = Modifier.size(14.dp))
                                    }
                                }
                            }
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .border(
                                        width = 1.dp,
                                        color = Divider,
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .clickable { imagePicker.launch("image/*") },
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("📷", fontSize = 24.sp)
                                    Text("添加", fontSize = 11.sp, color = TextSecondary)
                                }
                            }
                        }
                    }
                }

                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("商品名称 *") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = originalPrice,
                                onValueChange = { originalPrice = it },
                                label = { Text("原价") },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                prefix = { Text("¥") }
                            )
                            OutlinedTextField(
                                value = marketPrice,
                                onValueChange = { marketPrice = it },
                                label = { Text("市场价") },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                prefix = { Text("¥") }
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = expectedPrice,
                            onValueChange = { expectedPrice = it },
                            label = { Text("预期出售价") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            prefix = { Text("¥") }
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = quantity,
                            onValueChange = { quantity = it.filter { c -> c.isDigit() } },
                            label = { Text("库存数量 *") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = storageLocation,
                            onValueChange = { storageLocation = it },
                            label = { Text("仓储位置") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = remark,
                            onValueChange = { remark = it },
                            label = { Text("备注信息") },
                            minLines = 2,
                            maxLines = 4,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))

                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("分区与编码", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = OnBackground)
                        Spacer(Modifier.height(12.dp))

                        ExposedDropdownMenuBox(
                            expanded = mainZoneExpanded,
                            onExpandedChange = { mainZoneExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = mainZone,
                                onValueChange = { mainZone = it; mainZoneExpanded = false },
                                label = { Text("主分区") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mainZoneExpanded) }
                            )
                            ExposedDropdownMenu(expanded = mainZoneExpanded, onDismissRequest = { mainZoneExpanded = false }) {
                                (availableZones + listOf("A", "B", "C", "D", "E")).distinct().forEach { zone ->
                                    DropdownMenuItem(
                                        text = { Text(zone) },
                                        onClick = { mainZone = zone; mainZoneExpanded = false }
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))

                        ExposedDropdownMenuBox(
                            expanded = subZoneExpanded,
                            onExpandedChange = { subZoneExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = subZone,
                                onValueChange = { subZone = it; subZoneExpanded = false },
                                label = { Text("子分区") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = subZoneExpanded) }
                            )
                            ExposedDropdownMenu(expanded = subZoneExpanded, onDismissRequest = { subZoneExpanded = false }) {
                                (availableSubZones + listOf("1", "2", "3", "4", "5", "6", "7", "8", "9")).distinct().forEach { zone ->
                                    DropdownMenuItem(
                                        text = { Text(zone) },
                                        onClick = { subZone = zone; subZoneExpanded = false }
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))

                        ExposedDropdownMenuBox(
                            expanded = statusExpanded,
                            onExpandedChange = { statusExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = statusCodes.find { it.code == statusCode }?.let { "${it.code} - ${it.label}" } ?: statusCode,
                                onValueChange = {},
                                label = { Text("状态编码") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusExpanded) },
                                enabled = false
                            )
                            ExposedDropdownMenu(expanded = statusExpanded, onDismissRequest = { statusExpanded = false }) {
                                statusCodes.forEach { sc ->
                                    DropdownMenuItem(
                                        text = { Text("${sc.code} - ${sc.label}") },
                                        onClick = { statusCode = sc.code; statusExpanded = false }
                                    )
                                }
                            }
                        }

                        if (codePreview.isNotBlank()) {
                            Spacer(Modifier.height(12.dp))
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = TagBlueBg
                            ) {
                                Text(
                                    "生成编码: $codePreview",
                                    fontSize = 13.sp,
                                    color = TagBlueText,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("标签", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = OnBackground, modifier = Modifier.weight(1f))
                            TextButton(onClick = { showNewTagDialog = true; newTagName = ""; newTagColor = "#1890ff" }) {
                                Icon(Icons.Default.Add, null, modifier = Modifier.size(14.dp), tint = Primary)
                                Spacer(Modifier.width(2.dp))
                                Text("新建", fontSize = 13.sp, color = Primary)
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        if (allTags.isNotEmpty()) {
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                allTags.forEach { tag ->
                                    val isSelected = tag.id in selectedTagIds
                                    val tagColor = parseTagColor(tag.color)
                                    Surface(
                                        shape = RoundedCornerShape(16.dp),
                                        color = if (isSelected) tagColor.copy(alpha = 0.1f) else Color(0xFFF5F5F5),
                                        onClick = {
                                            selectedTagIds = if (isSelected) selectedTagIds - tag.id
                                            else selectedTagIds + tag.id
                                        }
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier.size(8.dp).clip(CircleShape)
                                                    .background(if (isSelected) tagColor else TagGrayText)
                                            )
                                            Spacer(Modifier.width(6.dp))
                                            Text(
                                                tag.name,
                                                fontSize = 12.sp,
                                                color = if (isSelected) tagColor else TextSecondary,
                                                fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            Text("暂无标签", fontSize = 13.sp, color = TextSecondary)
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))

                if (error != null) {
                    Text(error!!, color = Error, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 16.dp))
                    Spacer(Modifier.height(8.dp))
                }

                Button(
                    onClick = {
                        saving = true
                        error = null
                        scope.launch {
                            val qty = quantity.toIntOrNull()
                            val oPrice = originalPrice.toDoubleOrNull()
                            val mPrice = marketPrice.toDoubleOrNull()
                            val ePrice = expectedPrice.toDoubleOrNull()
                            val tags = selectedTagIds.toList().ifEmpty { null }
                            if (isEditing && productId != null) {
                                productRepo.update(
                                    UpdateProductReq(
                                        id = productId,
                                        name = name,
                                        quantity = qty,
                                        originalPrice = oPrice,
                                        marketPrice = mPrice,
                                        expectedPrice = ePrice,
                                        storageLocation = storageLocation.ifBlank { null },
                                        remark = remark.ifBlank { null },
                                        statusCode = statusCode,
                                        mainZone = mainZone,
                                        subZone = subZone,
                                        imageUrl = imageUrls.firstOrNull(),
                                        tags = tags
                                    )
                                ).fold(
                                    onSuccess = { saving = false; onBack() },
                                    onFailure = { e -> error = e.message; saving = false }
                                )
                            } else {
                                productRepo.allocateSeq(currentInventoryId, mainZone, subZone).fold(
                                    onSuccess = { seq ->
                                        inboundRepo.single(
                                            InboundSingleReq(
                                                inventoryId = currentInventoryId,
                                                code = "$mainZone$subZone-${seq.toString().padStart(4, '0')}",
                                                mainZone = mainZone,
                                                subZone = subZone,
                                                seqNumber = seq,
                                                quantity = qty,
                                                statusCode = statusCode,
                                                name = name,
                                                originalPrice = oPrice,
                                                marketPrice = mPrice,
                                                expectedPrice = ePrice,
                                                remark = remark.ifBlank { null },
                                                storageLocation = storageLocation.ifBlank { null },
                                                imageUrl = imageUrls.firstOrNull(),
                                                tags = tags
                                            )
                                        ).fold(
                                            onSuccess = { saving = false; onBack() },
                                            onFailure = { e -> error = e.message; saving = false }
                                        )
                                    },
                                    onFailure = { e -> error = e.message; saving = false }
                                )
                            }
                        }
                    },
                    enabled = saveEnabled && !saving,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                ) {
                    if (saving) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnPrimary, strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(if (isEditing) "保存修改" else "确认新建", color = OnPrimary, modifier = Modifier.padding(vertical = 4.dp))
                }

                Spacer(Modifier.height(32.dp))
            }
        }
    }

    if (showNewTagDialog) {
        AlertDialog(
            onDismissRequest = { showNewTagDialog = false },
            shape = RoundedCornerShape(12.dp),
            title = { Text("新建标签", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    OutlinedTextField(
                        value = newTagName,
                        onValueChange = { newTagName = it },
                        label = { Text("标签名称") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(12.dp))
                    Text("选择颜色", fontSize = 13.sp, color = TextSecondary)
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        tagColors.forEach { colorHex ->
                            val isSelected = newTagColor == colorHex
                            Box(
                                modifier = Modifier.size(32.dp)
                                    .clip(CircleShape)
                                    .background(parseTagColor(colorHex))
                                    .clickable { newTagColor = colorHex },
                                contentAlignment = Alignment.Center
                            ) {
                                if (isSelected) {
                                    Text("✓", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newTagName.isNotBlank()) {
                            showNewTagDialog = false
                            scope.launch {
                                tagRepo.create(newTagName, newTagColor).fold(
                                    onSuccess = {
                                        tagRepo.loadTags().fold(
                                            onSuccess = { allTags = it },
                                            onFailure = {}
                                        )
                                    },
                                    onFailure = {}
                                )
                            }
                        }
                    },
                    enabled = newTagName.isNotBlank()
                ) {
                    Text("创建", color = Primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { showNewTagDialog = false }) {
                    Text("取消", color = TextSecondary)
                }
            }
        )
    }
}

}

private val tagColors = listOf(
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



package com.goodser.app.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.TagRepository
import com.goodser.app.ui.components.ConfirmDialog
import com.goodser.app.ui.components.InputDialog
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch
import androidx.compose.foundation.background

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagManagementScreen(onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val repo = remember { TagRepository() }
    var tags by remember { mutableStateOf<List<GoodserTag>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var showCreate by remember { mutableStateOf(false) }
    var showEdit by remember { mutableStateOf<GoodserTag?>(null) }
    var showDelete by remember { mutableStateOf<GoodserTag?>(null) }

    LaunchedEffect(Unit) {
        repo.loadTags().fold(
            onSuccess = { tags = it; loading = false },
            onFailure = { loading = false }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("标签管理") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                actions = { IconButton(onClick = { showCreate = true }) { Icon(Icons.Default.Add, "添加") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary, actionIconContentColor = OnPrimary)
            )
        }
    ) { padding ->
        if (loading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(tags, key = { it.id }) { tag ->
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(12.dp).clip(CircleShape).background(Color(android.graphics.Color.parseColor(tag.color))))
                            Spacer(Modifier.width(12.dp))
                            Text(tag.name, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                            IconButton(onClick = { showEdit = tag }) { Icon(Icons.Default.Edit, "编辑", tint = Primary) }
                            IconButton(onClick = { showDelete = tag }) { Icon(Icons.Default.Delete, "删除", tint = Error) }
                        }
                    }
                }
            }
        }
    }

    if (showCreate) {
        InputDialog(title = "新建标签", placeholder = "标签名称", onConfirm = { name ->
            scope.launch {
                repo.create(name, "#1890ff").fold(
                    onSuccess = { tags = tags + it },
                    onFailure = {}
                )
            }
            showCreate = false
        }, onDismiss = { showCreate = false })
    }
    showEdit?.let { tag ->
        InputDialog(title = "编辑标签", initialValue = tag.name, placeholder = "标签名称", onConfirm = { name ->
            scope.launch {
                repo.update(tag.id, name, null).fold(
                    onSuccess = { updated -> tags = tags.map { if (it.id == tag.id) updated else it } },
                    onFailure = {}
                )
            }
            showEdit = null
        }, onDismiss = { showEdit = null })
    }
    showDelete?.let { tag ->
        ConfirmDialog(title = "删除标签", message = "确定删除标签「」？", onConfirm = {
            scope.launch {
                repo.delete(tag.id).fold(
                    onSuccess = { tags = tags.filter { it.id != tag.id } },
                    onFailure = {}
                )
            }
            showDelete = null
        }, onDismiss = { showDelete = null }, isDestructive = true)
    }
}

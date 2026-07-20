package com.goodser.app.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.model.*
import com.goodser.app.data.repository.StatusCodeRepository
import com.goodser.app.ui.SyncEventBus
import com.goodser.app.ui.components.ConfirmDialog
import com.goodser.app.ui.components.InputDialog
import com.goodser.app.ui.components.PullRefreshBox
import com.goodser.app.ui.theme.*
import kotlinx.coroutines.launch
import androidx.compose.foundation.background

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatusCodeScreen(onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val repo = remember { StatusCodeRepository() }
    var codes by remember { mutableStateOf<List<StatusCode>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var showCreate by remember { mutableStateOf(false) }
    var showEdit by remember { mutableStateOf<StatusCode?>(null) }
    var showDelete by remember { mutableStateOf<StatusCode?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        SyncEventBus.events.collect { refreshKey++ }
    }

    LaunchedEffect(Unit, refreshKey) {
        repo.loadStatusCodes().fold(
            onSuccess = { codes = it; loading = false },
            onFailure = { loading = false }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("状态编码管理") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                actions = { IconButton(onClick = { showCreate = true }) { Icon(Icons.Default.Add, "添加") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary, actionIconContentColor = OnPrimary)
            )
        }
    ) { padding ->
        PullRefreshBox(
            refreshing = loading,
            onRefresh = { refreshKey++ },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            if (loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(codes, key = { it.id }) { code ->
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(code.code, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Primary, modifier = Modifier.width(40.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(code.label, fontWeight = FontWeight.Medium)
                                if (code.isSystem) Text("系统预设", fontSize = 11.sp, color = TextSecondary)
                            }
                            if (!code.isSystem) {
                                IconButton(onClick = { showEdit = code }) { Icon(Icons.Default.Edit, "编辑", tint = Primary) }
                                IconButton(onClick = { showDelete = code }) { Icon(Icons.Default.Delete, "删除", tint = Error) }
                            }
                        }
                    }
                }
            }
        }
    }
}

    if (showCreate) {
        var newCode by remember { mutableStateOf("") }
        var newLabel by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showCreate = false },
            title = { Text("添加状态编码") },
            text = {
                Column {
                    OutlinedTextField(value = newCode, onValueChange = { if (it.length <= 1) newCode = it.uppercase() }, label = { Text("编码 (A-Z)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(value = newLabel, onValueChange = { newLabel = it }, label = { Text("名称") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = { TextButton(onClick = {
                scope.launch {
                    repo.add(newCode, newLabel).fold(
                        onSuccess = { codes = codes + it },
                        onFailure = {}
                    )
                }
                showCreate = false
            }) { Text("添加") } },
            dismissButton = { TextButton(onClick = { showCreate = false }) { Text("取消") } },
            shape = RoundedCornerShape(12.dp)
        )
    }
    showEdit?.let { code ->
        var editLabel by remember(code.id) { mutableStateOf(code.label) }
        AlertDialog(
            onDismissRequest = { showEdit = null },
            title = { Text("编辑状态编码「${code.code}」") },
            text = { OutlinedTextField(value = editLabel, onValueChange = { editLabel = it }, label = { Text("名称") }, singleLine = true, modifier = Modifier.fillMaxWidth()) },
            confirmButton = { TextButton(onClick = {
                scope.launch { repo.update(code.id, editLabel).fold(onSuccess = { updated -> codes = codes.map { if (it.id == code.id) updated else it } }, onFailure = {}) }
                showEdit = null
            }) { Text("保存") } },
            dismissButton = { TextButton(onClick = { showEdit = null }) { Text("取消") } },
            shape = RoundedCornerShape(12.dp)
        )
    }
    showDelete?.let { code ->
        ConfirmDialog(title = "删除状态编码", message = "确定删除编码「${code.code}」？", onConfirm = {
            scope.launch { repo.remove(code.id).fold(onSuccess = { codes = codes.filter { it.id != code.id } }, onFailure = {}) }
            showDelete = null
        }, onDismiss = { showDelete = null }, isDestructive = true)
    }
}

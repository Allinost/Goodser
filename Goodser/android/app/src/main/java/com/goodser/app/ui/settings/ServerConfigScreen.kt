package com.goodser.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.model.ServerEntry
import com.goodser.app.ui.theme.*
import com.goodser.app.util.TokenManager
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerConfigScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val tokenManager = remember { TokenManager(context) }
    var servers by remember { mutableStateOf<List<ServerEntry>>(emptyList()) }
    var showAddDialog by remember { mutableStateOf(false) }
    var testingId by remember { mutableStateOf<String?>(null) }
    var testResult by remember { mutableStateOf<Pair<String, String>?>(null) }

    LaunchedEffect(Unit) {
        servers = tokenManager.getServerList()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("服务器配置") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                actions = {
                    IconButton(onClick = { showAddDialog = true }) {
                        Icon(Icons.Default.Add, "添加", tint = OnPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Primary, titleContentColor = OnPrimary,
                    navigationIconContentColor = OnPrimary, actionIconContentColor = OnPrimary
                )
            )
        }
    ) { padding ->
        if (servers.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(padding).background(Background), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("暂无服务器配置", fontSize = 14.sp, color = TextSecondary)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { showAddDialog = true }) { Text("添加服务器") }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding).background(Background).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(servers, key = { _, s -> s.id }) { index, server ->
                    ServerCard(
                        server = server,
                        isFirst = index == 0,
                        isLast = index == servers.size - 1,
                        testing = testingId == server.id,
                        testResult = testResult?.let { if (it.first == server.id) it.second else null },
                        onToggle = {
                            scope.launch {
                                tokenManager.toggleServer(server.id)
                                servers = tokenManager.getServerList()
                            }
                        },
                        onMoveUp = {
                            scope.launch {
                                tokenManager.reorderServer(server.id, up = true)
                                servers = tokenManager.getServerList()
                            }
                        },
                        onMoveDown = {
                            scope.launch {
                                tokenManager.reorderServer(server.id, up = false)
                                servers = tokenManager.getServerList()
                            }
                        },
                        onTest = {
                            scope.launch {
                                testingId = server.id; testResult = null
                                try {
                                    RetrofitClient.updateBaseUrl(server.url)
                                    testResult = server.id to "连接成功"
                                } catch (e: Exception) {
                                    testResult = server.id to "连接失败: ${e.message}"
                                }
                                testingId = null
                            }
                        },
                        onDelete = {
                            scope.launch {
                                tokenManager.removeServer(server.id)
                                servers = tokenManager.getServerList()
                            }
                        }
                    )
                }
            }
        }
    }

    if (showAddDialog) {
        var newUrl by remember { mutableStateOf("http://") }
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            shape = RoundedCornerShape(12.dp),
            title = { Text("添加服务器", fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = newUrl,
                    onValueChange = { newUrl = it },
                    label = { Text("服务器地址") },
                    placeholder = { Text("http://192.168.1.36:29090") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (newUrl.isNotBlank()) {
                            showAddDialog = false
                            scope.launch {
                                tokenManager.addServer(newUrl)
                                servers = tokenManager.getServerList()
                            }
                        }
                    },
                    enabled = newUrl.isNotBlank()
                ) { Text("添加", color = Primary) }
            },
            dismissButton = { TextButton(onClick = { showAddDialog = false }) { Text("取消", color = TextSecondary) } }
        )
    }
}

@Composable
private fun ServerCard(
    server: ServerEntry,
    isFirst: Boolean,
    isLast: Boolean,
    testing: Boolean,
    testResult: String?,
    onToggle: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onTest: () -> Unit,
    onDelete: () -> Unit
) {
    Card(shape = RoundedCornerShape(10.dp), colors = CardDefaults.cardColors(containerColor = Surface)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(server.url, fontSize = 14.sp, color = OnBackground, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (server.active) {
                        Text("当前使用", fontSize = 11.sp, color = Success)
                    }
                }
                Switch(
                    checked = server.active,
                    onCheckedChange = { onToggle() },
                    colors = SwitchDefaults.colors(checkedThumbColor = OnPrimary, checkedTrackColor = Primary)
                )
            }
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(onClick = onMoveUp, enabled = !isFirst, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.KeyboardArrowUp, "上移", tint = if (isFirst) TextSecondary.copy(alpha = 0.3f) else TextSecondary, modifier = Modifier.size(20.dp))
                    }
                    IconButton(onClick = onMoveDown, enabled = !isLast, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.KeyboardArrowDown, "下移", tint = if (isLast) TextSecondary.copy(alpha = 0.3f) else TextSecondary, modifier = Modifier.size(20.dp))
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (testing) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        TextButton(onClick = onTest, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)) {
                            Text("测试", fontSize = 12.sp, color = Primary)
                        }
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Delete, "删除", tint = Error, modifier = Modifier.size(18.dp))
                    }
                }
            }
            if (testResult != null) {
                Spacer(Modifier.height(4.dp))
                Text(testResult, fontSize = 12.sp, color = if (testResult.startsWith("连接成功")) Success else Error)
            }
        }
    }
}
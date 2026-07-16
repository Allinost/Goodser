package com.goodser.app.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.ui.theme.*
import com.goodser.app.util.TokenManager
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch
import androidx.compose.foundation.background

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServerConfigScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val tokenManager = remember { TokenManager(context) }
    var serverUrl by remember { mutableStateOf("http://192.168.1.36:29090") }
    var saved by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        tokenManager.getServerUrl()?.let { serverUrl = it }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("服务器配置") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Primary, titleContentColor = OnPrimary, navigationIconContentColor = OnPrimary)
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp).background(Background)) {
            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("服务器地址") },
                placeholder = { Text("http://192.168.1.36:29090") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(8.dp))
            Text("请输入Go后端服务的URL地址", fontSize = 12.sp, color = TextSecondary)
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = {
                    scope.launch {
                        RetrofitClient.updateBaseUrl(serverUrl)
                        tokenManager.saveServerUrl(serverUrl)
                        saved = true
                    }
                },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(8.dp)
            ) { Text("保存配置") }
            if (saved) {
                Spacer(Modifier.height(8.dp))
                Text("配置已保存", color = Success, fontSize = 13.sp)
            }
        }
    }
}

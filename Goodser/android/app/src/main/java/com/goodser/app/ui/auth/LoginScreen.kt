package com.goodser.app.ui.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.api.RetrofitClient
import com.goodser.app.data.repository.AuthRepository
import com.goodser.app.ui.theme.*
import com.goodser.app.util.TokenManager
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onNavigateToRegister: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val tokenManager = remember { TokenManager(context) }
    val repository = remember { AuthRepository(tokenManager) }
    var serverUrl by remember { mutableStateOf("http://192.168.1.36:29090") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var testing by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        tokenManager.getServerUrl()?.let { serverUrl = it }
        tokenManager.getRememberMe().let { rm ->
            rememberMe = rm
            if (rm) {
                tokenManager.getUsername()?.let { username = it }
                tokenManager.getPassword()?.let { password = it }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(48.dp))
        Text("Goodser", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Primary)
        Text("库存管理系统", fontSize = 14.sp, color = TextSecondary)
        Spacer(Modifier.height(32.dp))

        OutlinedTextField(
            value = serverUrl,
            onValueChange = { serverUrl = it },
            label = { Text("服务器地址") },
            placeholder = { Text("http://192.168.1.36:29090") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            supportingText = { Text("Go 后端地址，含端口号", fontSize = 11.sp) }
        )
        Spacer(Modifier.height(8.dp))

        Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
            TextButton(
                onClick = {
                    scope.launch {
                        testing = true; error = null
                        try {
                            RetrofitClient.updateBaseUrl(serverUrl)
                            tokenManager.saveServerUrl(serverUrl)
                            error = "连接成功"
                        } catch (e: Exception) {
                            error = "连接失败: ${e.message}"
                        }
                        testing = false
                    }
                },
                enabled = !testing && serverUrl.isNotBlank()
            ) {
                Text(if (testing) "测试中..." else "测试连接", fontSize = 13.sp)
            }
        }
        Spacer(Modifier.height(16.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("用户名") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("密码") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))

        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it })
            Text("记住密码", fontSize = 14.sp, color = TextPrimary, modifier = Modifier.clickable { rememberMe = !rememberMe })
        }

        if (error != null) {
            Spacer(Modifier.height(8.dp))
            Text(error!!, color = if (error == "连接成功") Success else Error, fontSize = 13.sp)
        }
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = {
                scope.launch {
                    loading = true; error = null
                    RetrofitClient.updateBaseUrl(serverUrl)
                    tokenManager.saveServerUrl(serverUrl)
                    repository.login(username, password).fold(
                        onSuccess = {
                            tokenManager.saveUsername(username)
                            tokenManager.saveRememberMe(rememberMe)
                            if (rememberMe) tokenManager.savePassword(password)
                            else tokenManager.savePassword("")
                            loading = false; onLoginSuccess()
                        },
                        onFailure = { loading = false; error = it.message }
                    )
                }
            },
            enabled = !loading && username.isNotBlank() && password.isNotBlank() && serverUrl.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = RoundedCornerShape(8.dp)
        ) {
            if (loading) CircularProgressIndicator(modifier = Modifier.size(20.dp), color = OnPrimary)
            else Text("登录")
        }
        Spacer(Modifier.height(16.dp))
        TextButton(onClick = onNavigateToRegister) {
            Text("没有账号？立即注册", color = Primary)
        }
    }
}

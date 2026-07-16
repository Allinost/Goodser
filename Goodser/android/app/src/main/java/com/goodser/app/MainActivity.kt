package com.goodser.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.goodser.app.ui.navigation.GoodserNavGraph
import com.goodser.app.ui.theme.GoodserTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            GoodserTheme {
                GoodserNavGraph()
            }
        }
    }
}

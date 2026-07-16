package com.goodser.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.goodser.app.data.model.OutboundOrder
import com.goodser.app.ui.theme.*

@Composable
fun OrderCard(
    order: OutboundOrder,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Surface, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TypeTag(
                    text = if (order.type == "reserve") "预留单" else "出库单",
                    bg = if (order.type == "reserve") TagOrangeBg else TagBlueBg,
                    textColor = if (order.type == "reserve") TagOrangeText else TagBlueText
                )
                Spacer(Modifier.width(8.dp))
                Text(order.orderNo, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = OnBackground)
            }
            OrderStatusTag(order.status, order.type)
        }
        Spacer(Modifier.height(4.dp))
        Text(order.createdAt.take(16), fontSize = 13.sp, color = TextSecondary)
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = Divider)
        order.items?.forEach { item ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(item.productName, fontSize = 14.sp, color = TextSecondary)
                Text("x ${item.quantity}", fontSize = 14.sp, color = OnBackground, fontWeight = FontWeight.Medium)
            }
        }
        if (order.items.isNullOrEmpty()) {
            Text("无商品", fontSize = 14.sp, color = TextSecondary)
        }
        Spacer(Modifier.height(4.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "共 ${order.items?.size ?: 0} 种商品，合计 ${order.items?.sumOf { it.quantity } ?: 0} 件",
                fontSize = 13.sp,
                color = TextSecondary
            )
            Text("查看详情 >", fontSize = 14.sp, color = Primary)
        }
    }
}

@Composable
fun TypeTag(text: String, bg: androidx.compose.ui.graphics.Color, textColor: androidx.compose.ui.graphics.Color) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = textColor,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .background(bg, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp)
    )
}

@Composable
fun OrderStatusTag(status: String, type: String) {
    val (text, bg, textColor) = when {
        status == "confirmed" -> Triple("已确认", TagGreenBg, TagGreenText)
        status == "cancelled" -> Triple("已取消", TagGrayBg, TagGrayText)
        type == "reserve" && status == "reserved" -> Triple("预留中", TagOrangeBg, TagOrangeText)
        type == "reserve" -> Triple("预留", TagOrangeBg, TagOrangeText)
        else -> Triple("待确认", TagBlueBg, TagBlueText)
    }
    Text(
        text = text,
        fontSize = 11.sp,
        color = textColor,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .background(bg, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp)
    )
}

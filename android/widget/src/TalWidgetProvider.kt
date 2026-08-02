package kr.ac.tukorea.taljungwang // TODO: 실제 패키지명으로 교체

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * 탈것:정왕 홈 위젯.
 *
 * GET /api/v1/widget 한 번으로 "다음 셔틀/버스/지하철" 최대 3줄을 그린다.
 * 표기 가공(분 반올림·막차 표시)은 전부 서버가 끝낸 문자열이라 여기선 꽂기만 한다 —
 * 위젯은 크래시해도 사용자가 원인을 볼 수 없으므로 클라이언트 로직을 얇게 유지한다.
 */
class TalWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val BASE = "https://www.taljungwang.kr"
        private const val ENDPOINT = "$BASE/api/v1/widget"
        const val ACTION_REFRESH = "kr.ac.tukorea.taljungwang.WIDGET_REFRESH"

        // 행 3개의 뷰 id를 한 곳에 묶어둔다(레이아웃 4x1/4x2 공용).
        private val ROW_IDS = listOf(
            Triple(R.id.row1, R.id.row1_label, R.id.row1_value),
            Triple(R.id.row2, R.id.row2_label, R.id.row2_value),
            Triple(R.id.row3, R.id.row3_label, R.id.row3_value),
        )
        private val ROW_SUB_IDS = listOf(R.id.row1_sub, R.id.row2_sub, R.id.row3_sub)
        private val ROW_BADGE_IDS = listOf(R.id.row1_badge, R.id.row2_badge, R.id.row3_badge)

        private val executor = Executors.newSingleThreadExecutor()

        private fun badgeText(kind: String): String = when (kind) {
            "shuttle" -> "셔"
            "bus" -> "버"
            "subway" -> "철"
            else -> "•"
        }

        /** "4분"/"곧"이면 임박 색으로 — 숫자 5 이하이거나 "곧". */
        private fun isImminent(value: String): Boolean {
            if (value.startsWith("곧")) return true
            val n = value.takeWhile { it.isDigit() }.toIntOrNull() ?: return false
            return value.endsWith("분") && n <= 5
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { refresh(context, manager, it) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        // 수동 새로고침(↻)과 화면 잠금 해제 시 갱신 — updatePeriodMillis 최소값이
        // 30분이라 "볼 때 신선하게"는 이 두 트리거가 담당한다.
        if (intent.action == ACTION_REFRESH || intent.action == Intent.ACTION_USER_PRESENT) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, TalWidgetProvider::class.java)
            )
            onUpdate(context, manager, ids)
        }
    }

    private fun refresh(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val views = RemoteViews(context.packageName, R.layout.widget_tal)

        // 탭 동작 — 본문은 앱 열기, ↻는 갱신 브로드캐스트.
        val open = Intent(Intent.ACTION_VIEW, Uri.parse("$BASE/?commute=up"))
        views.setOnClickPendingIntent(
            R.id.widget_root,
            PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        )
        val refreshIntent = Intent(context, TalWidgetProvider::class.java).setAction(ACTION_REFRESH)
        views.setOnClickPendingIntent(
            R.id.widget_refresh,
            PendingIntent.getBroadcast(
                context, 1, refreshIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        )
        manager.partiallyUpdateAppWidget(widgetId, views)

        executor.execute {
            val payload = fetch()
            // 실패하면 아무것도 덮어쓰지 않는다 — 마지막으로 성공한 화면이 남는 편이
            // "정보 없음"으로 깜빡이는 것보다 낫다.
            if (payload != null) {
                render(context, manager, widgetId, payload)
            }
        }
    }

    private fun fetch(): JSONObject? = try {
        val conn = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            connectTimeout = 5000
            readTimeout = 5000
            setRequestProperty("Accept", "application/json")
        }
        conn.inputStream.bufferedReader().use { it.readText() }
            .let { JSONObject(it) }
            .takeIf { it.optBoolean("success") }
            ?.optJSONObject("data")
    } catch (_: Exception) {
        null
    }

    private fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        data: JSONObject,
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_tal)
        val items = data.optJSONArray("items")
        val accent = context.getColor(R.color.tj_accent)
        val ink = context.getColor(R.color.tj_ink)

        views.setTextViewText(R.id.widget_title, "탈것:정왕 · ${data.optString("direction", "")}")
        views.setTextViewText(R.id.widget_updated, "${data.optString("updated_at", "")} 갱신")

        val count = items?.length() ?: 0
        for (i in ROW_IDS.indices) {
            val (rowId, labelId, valueId) = ROW_IDS[i]
            val item = if (i < count) items!!.optJSONObject(i) else null
            if (item == null) {
                views.setViewVisibility(rowId, View.GONE)
                continue
            }
            val value = item.optString("value", "-")
            views.setViewVisibility(rowId, View.VISIBLE)
            views.setTextViewText(ROW_BADGE_IDS[i], badgeText(item.optString("kind")))
            views.setTextViewText(labelId, item.optString("label"))
            views.setTextViewText(ROW_SUB_IDS[i], item.optString("sub"))
            views.setTextViewText(valueId, value)
            views.setTextColor(valueId, if (isImminent(value)) accent else ink)
        }

        val emptyText = data.optString("empty_text", "")
        views.setViewVisibility(R.id.widget_empty, if (count == 0) View.VISIBLE else View.GONE)
        if (count == 0) views.setTextViewText(R.id.widget_empty, emptyText)

        manager.updateAppWidget(widgetId, views)
    }
}

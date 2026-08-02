package kr.ac.tukorea.taljungwang // TODO: 실제 패키지명으로 교체 (위젯 소스 4개 모두)

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * 학사일정 위젯 (4×2, 4×1 로 줄이면 아래 줄부터 잘린다).
 *
 * 고를 게 없는 위젯이라 칩이 없고 대신 새로고침이 있다. 수강신청처럼 "놓치면 끝"인
 * 일정을 보는 자리라 사용자가 직접 최신화할 수단을 남겨 둔다.
 */
class CalendarWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_REFRESH = "kr.ac.tukorea.taljungwang.WIDGET_REFRESH_CALENDAR"

        private val ROW_IDS = intArrayOf(R.id.cal_row_0, R.id.cal_row_1, R.id.cal_row_2)
        private val BADGE_IDS = intArrayOf(R.id.cal_badge_0, R.id.cal_badge_1, R.id.cal_badge_2)
        private val LABEL_IDS = intArrayOf(R.id.cal_label_0, R.id.cal_label_1, R.id.cal_label_2)
        private val SUB_IDS = intArrayOf(R.id.cal_sub_0, R.id.cal_sub_1, R.id.cal_sub_2)

        private const val SLOT_REFRESH = 0
        private const val SLOT_OPEN = 1

        /**
         * 알약을 빨갛게 칠할지. 서버는 당일을 "D-0"이 아니라 "D-DAY"로 내려주므로
         * 숫자 파싱만으로는 정작 가장 급한 날을 놓친다.
         */
        fun isUrgent(badge: String): Boolean {
            if (badge == "진행 중" || badge == "D-DAY") return true
            if (!badge.startsWith("D-")) return false
            val days = badge.removePrefix("D-").toIntOrNull() ?: return false
            return days <= 3
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach {
            draw(context, manager, it, WidgetCommon.cached(context, it))
            load(context, manager, it)
        }
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        // 선택 상태는 없지만 캐시된 응답은 지워야 한다(forget 이 payload 도 함께 지운다).
        ids.forEach { WidgetCommon.forget(context, it, emptyList()) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val manager = AppWidgetManager.getInstance(context)
        when (intent.action) {
            // ↻ 는 누른 위젯 하나만 다시 부른다. 홈에 여러 개 붙어 있을 때 한 번의 탭으로
            // 서버를 N번 때리지 않도록 extra 로 대상을 좁힌다(없으면 전체가 폴백).
            ACTION_REFRESH -> {
                val id = intent.getIntExtra(
                    AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID
                )
                if (id == AppWidgetManager.INVALID_APPWIDGET_ID) {
                    WidgetCommon.idsOf(context, manager, javaClass).forEach { load(context, manager, it) }
                } else {
                    load(context, manager, id)
                }
            }
            Intent.ACTION_USER_PRESENT ->
                WidgetCommon.idsOf(context, manager, javaClass).forEach { load(context, manager, it) }
        }
    }

    private fun load(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val app = context.applicationContext
        WidgetCommon.executor.execute {
            val data = WidgetCommon.fetch("type=calendar") ?: return@execute
            WidgetCommon.cache(app, widgetId, data)
            draw(app, manager, widgetId, data)
        }
    }

    private fun draw(context: Context, manager: AppWidgetManager, widgetId: Int, data: JSONObject?) {
        val views = RemoteViews(context.packageName, R.layout.widget_calendar)
        views.setOnClickPendingIntent(
            R.id.widget_root, WidgetCommon.openApp(context, "/more", widgetId, SLOT_OPEN)
        )
        // 새로고침은 앱을 열지 않는다 — 이 위젯 하나만 다시 불러온다.
        val refresh = Intent(context, CalendarWidgetProvider::class.java)
            .setAction(ACTION_REFRESH)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
        views.setOnClickPendingIntent(
            R.id.cal_refresh,
            android.app.PendingIntent.getBroadcast(
                context, WidgetCommon.rc(widgetId, SLOT_REFRESH), refresh, WidgetCommon.PI_FLAGS
            )
        )

        views.setTextViewText(R.id.cal_title, WidgetCommon.str(data, "title").ifEmpty { "학사일정" })
        val updated = WidgetCommon.str(data, "updated_at")
        views.setTextViewText(R.id.cal_updated, if (updated.isEmpty()) "" else "$updated 갱신")

        val items = data?.optJSONArray("items")
        val emptyText = WidgetCommon.str(data, "empty_text")
        if (data == null || emptyText.isNotEmpty() || items == null || items.length() == 0) {
            views.setViewVisibility(R.id.cal_items, View.GONE)
            views.setViewVisibility(R.id.cal_empty, View.VISIBLE)
            views.setTextViewText(
                R.id.cal_empty, emptyText.ifEmpty { context.getString(R.string.widget_loading) }
            )
            manager.updateAppWidget(widgetId, views)
            return
        }

        views.setViewVisibility(R.id.cal_items, View.VISIBLE)
        views.setViewVisibility(R.id.cal_empty, View.GONE)
        for (i in ROW_IDS.indices) {
            val item = items.optJSONObject(i)
            if (item == null) {
                views.setViewVisibility(ROW_IDS[i], View.GONE)
                continue
            }
            views.setViewVisibility(ROW_IDS[i], View.VISIBLE)
            val badge = WidgetCommon.str(item, "badge")
            views.setViewVisibility(BADGE_IDS[i], if (badge.isEmpty()) View.GONE else View.VISIBLE)
            views.setTextViewText(BADGE_IDS[i], badge)
            views.setInt(
                BADGE_IDS[i], "setBackgroundResource",
                if (isUrgent(badge)) R.drawable.widget_badge_alert else R.drawable.widget_badge
            )
            views.setTextViewText(LABEL_IDS[i], WidgetCommon.str(item, "label"))
            views.setTextViewText(SUB_IDS[i], WidgetCommon.str(item, "sub"))
        }
        manager.updateAppWidget(widgetId, views)
    }
}

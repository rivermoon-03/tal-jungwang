package kr.ac.tukorea.taljungwang // TODO: 실제 패키지명으로 교체 (위젯 소스 4개 모두)

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * 학식 위젯 (2×2) — 식단(TIP 지하 / E동)과 운영정보(지금 문 연 매장)를 탭으로 오간다.
 *
 * 운영정보 탭이 있는 이유: 학식이 없는 주말·방학에도 위젯이 쓸모를 유지해야 한다.
 * 그때 식단 탭은 "등록된 식단이 없어요" 한 줄로 남지만 매장은 여전히 답을 준다.
 */
class CafeteriaWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_SELECT = "kr.ac.tukorea.taljungwang.WIDGET_SELECT_CAFETERIA"

        private val KEYS = listOf("view", "place")

        private val ROW_IDS = intArrayOf(R.id.cafe_row_0, R.id.cafe_row_1, R.id.cafe_row_2)
        private val DOT_IDS = intArrayOf(R.id.cafe_dot_0, R.id.cafe_dot_1, R.id.cafe_dot_2)
        private val LABEL_IDS = intArrayOf(R.id.cafe_label_0, R.id.cafe_label_1, R.id.cafe_label_2)
        private val DIM_IDS = intArrayOf(R.id.cafe_dim_0, R.id.cafe_dim_1, R.id.cafe_dim_2)
        private val SUB_IDS = intArrayOf(R.id.cafe_sub_0, R.id.cafe_sub_1, R.id.cafe_sub_2)

        private const val SLOT_PLACE_TIP = 0
        private const val SLOT_PLACE_EDONG = 1
        private const val SLOT_TAB_MENU = 2
        private const val SLOT_TAB_VENUES = 3
        private const val SLOT_OPEN = 4
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach {
            draw(context, manager, it, WidgetCommon.cached(context, it))
            load(context, manager, it)
        }
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        ids.forEach { WidgetCommon.forget(context, it, KEYS) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val manager = AppWidgetManager.getInstance(context)
        when (intent.action) {
            ACTION_SELECT -> {
                val id = intent.getIntExtra(
                    AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID
                )
                val key = intent.getStringExtra("key")
                val value = intent.getStringExtra("value")
                if (id == AppWidgetManager.INVALID_APPWIDGET_ID || key == null || value == null) return
                WidgetCommon.put(context, key, id, value)
                WidgetCommon.dropCache(context, id) // 식단↔운영정보는 줄 모양이 달라 섞이면 안 된다
                // 서버 왕복 전에 칩만 먼저 반영한다(누른 티가 나야 다시 누르지 않는다).
                manager.partiallyUpdateAppWidget(id, chipsOnly(context, id))
                load(context, manager, id)
            }
            Intent.ACTION_USER_PRESENT ->
                WidgetCommon.idsOf(context, manager, javaClass).forEach { load(context, manager, it) }
        }
    }

    private fun load(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val app = context.applicationContext
        val view = WidgetCommon.get(app, "view", widgetId, "menu")
        val place = WidgetCommon.get(app, "place", widgetId, "tip")
        WidgetCommon.executor.execute {
            val data = WidgetCommon.fetch("type=cafeteria&view=$view&place=$place") ?: return@execute
            WidgetCommon.cache(app, widgetId, data)
            draw(app, manager, widgetId, data)
        }
    }

    private fun chipsOnly(context: Context, widgetId: Int): RemoteViews =
        RemoteViews(context.packageName, R.layout.widget_cafeteria).also {
            applyChips(context, it, widgetId)
        }

    private fun applyChips(context: Context, views: RemoteViews, widgetId: Int) {
        val view = WidgetCommon.get(context, "view", widgetId, "menu")
        val place = WidgetCommon.get(context, "place", widgetId, "tip")

        // 식당 선택은 식단 탭에만 해당한다 — 운영정보에서는 세그를 숨긴다.
        val segVisibility = if (view == "venues") View.GONE else View.VISIBLE
        views.setViewVisibility(R.id.cafe_seg_tip, segVisibility)
        views.setViewVisibility(R.id.cafe_seg_edong, segVisibility)
        WidgetCommon.chip(context, views, R.id.cafe_seg_tip, place == "tip")
        WidgetCommon.chip(context, views, R.id.cafe_seg_edong, place == "edong")
        views.setOnClickPendingIntent(
            R.id.cafe_seg_tip,
            select(context, widgetId, "place", "tip", SLOT_PLACE_TIP)
        )
        views.setOnClickPendingIntent(
            R.id.cafe_seg_edong,
            select(context, widgetId, "place", "edong", SLOT_PLACE_EDONG)
        )

        WidgetCommon.chip(context, views, R.id.cafe_tab_menu, view != "venues")
        WidgetCommon.chip(context, views, R.id.cafe_tab_venues, view == "venues")
        views.setOnClickPendingIntent(
            R.id.cafe_tab_menu,
            select(context, widgetId, "view", "menu", SLOT_TAB_MENU)
        )
        views.setOnClickPendingIntent(
            R.id.cafe_tab_venues,
            select(context, widgetId, "view", "venues", SLOT_TAB_VENUES)
        )
    }

    private fun select(context: Context, widgetId: Int, key: String, value: String, slot: Int) =
        WidgetCommon.select(
            context, CafeteriaWidgetProvider::class.java, ACTION_SELECT, widgetId, key, value, slot
        )

    private fun draw(context: Context, manager: AppWidgetManager, widgetId: Int, data: JSONObject?) {
        val views = RemoteViews(context.packageName, R.layout.widget_cafeteria)
        applyChips(context, views, widgetId)
        views.setOnClickPendingIntent(
            R.id.widget_root, WidgetCommon.openApp(context, "/cafeteria", widgetId, SLOT_OPEN)
        )

        val view = WidgetCommon.get(context, "view", widgetId, "menu")
        // 식단 탭에서는 선택 칩이 곧 제목이라 제목 자리를 비운다. GONE 이 아니라 빈 문자열인
        // 이유: 이 뷰의 weight 가 오른쪽 끼니 칩을 밀어내는 역할을 겸한다.
        val title = if (view == "venues") WidgetCommon.str(data, "title").ifEmpty { "학식" } else ""
        views.setTextViewText(R.id.cafe_title, title)

        val meal = WidgetCommon.str(data, "meal")
        views.setViewVisibility(R.id.cafe_meal, if (meal.isEmpty()) View.GONE else View.VISIBLE)
        views.setTextViewText(R.id.cafe_meal, meal)

        val items = data?.optJSONArray("items")
        val emptyText = WidgetCommon.str(data, "empty_text")
        if (data == null || emptyText.isNotEmpty() || items == null || items.length() == 0) {
            views.setViewVisibility(R.id.cafe_items, View.GONE)
            views.setViewVisibility(R.id.cafe_empty, View.VISIBLE)
            views.setTextViewText(
                R.id.cafe_empty, emptyText.ifEmpty { context.getString(R.string.widget_loading) }
            )
            manager.updateAppWidget(widgetId, views)
            return
        }

        views.setViewVisibility(R.id.cafe_items, View.VISIBLE)
        views.setViewVisibility(R.id.cafe_empty, View.GONE)
        for (i in ROW_IDS.indices) {
            val item = items.optJSONObject(i)
            if (item == null) {
                views.setViewVisibility(ROW_IDS[i], View.GONE)
                continue
            }
            views.setViewVisibility(ROW_IDS[i], View.VISIBLE)
            val kind = WidgetCommon.str(item, "kind")
            val label = WidgetCommon.str(item, "label")
            val sub = WidgetCommon.str(item, "sub")

            // 한 줄의 세 얼굴: 굵은 메뉴 / 흐린 나머지메뉴 / 점 붙은 매장.
            // 폰트 크기를 런타임에 못 바꾸므로 미리 깔아둔 두 TextView 중 하나만 켠다.
            val dim = kind == "menu_more"
            views.setViewVisibility(DIM_IDS[i], if (dim) View.VISIBLE else View.GONE)
            views.setViewVisibility(LABEL_IDS[i], if (dim) View.GONE else View.VISIBLE)
            views.setTextViewText(if (dim) DIM_IDS[i] else LABEL_IDS[i], label)

            views.setViewVisibility(DOT_IDS[i], if (kind == "venue") View.VISIBLE else View.GONE)
            views.setViewVisibility(SUB_IDS[i], if (sub.isEmpty()) View.GONE else View.VISIBLE)
            views.setTextViewText(SUB_IDS[i], sub)
        }
        manager.updateAppWidget(widgetId, views)
    }
}

package kr.ac.tukorea.taljungwang // TODO: 실제 패키지명으로 교체 (위젯 소스 4개 모두)

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * 교통 위젯 (4×2) — 셔틀/지하철의 다음 차를 좌우 2열(등교·하교 / 상행·하행)로 보여준다.
 *
 * 버스는 싣지 않는다. GBIS 실시간은 노선·정류장별 편차가 크고 시간표 폴백이 섞이는데,
 * 위젯에는 "실시간인지 시간표인지"를 밝힐 자리가 없다. 확인 없이 믿는 자리에는
 * 근거를 함께 보여줄 수 있는 데이터만 올린다(버스는 앱 홈에서 근거와 함께 본다).
 *
 * 선택 상태(mode/campus/station)는 위젯 인스턴스별로 저장한다 — 같은 사람이 홈에
 * "1캠 셔틀"과 "정왕역 지하철"을 나란히 두는 게 이 위젯의 사용법이다.
 */
class TransitWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_SELECT = "kr.ac.tukorea.taljungwang.WIDGET_SELECT_TRANSIT"

        private val KEYS = listOf("mode", "campus", "station")

        // 서버 selector.options 와 같은 값. 응답이 없어도 칩은 그려야 하므로 여기에 둔다.
        private val OPTIONS = mapOf(
            "campus" to listOf("main", "second"),
            "station" to listOf("정왕", "초지", "시흥시청"),
        )
        // 역 이름은 그대로 쓰지만 캠퍼스 코드는 사람이 읽는 말로 바꿔야 한다.
        private val CAMPUS_LABEL = mapOf("main" to "1캠", "second" to "2캠")

        private val SEG_IDS = intArrayOf(R.id.transit_seg_0, R.id.transit_seg_1, R.id.transit_seg_2)
        private val COL_LABEL = intArrayOf(R.id.col0_label, R.id.col1_label)
        private val COL_DEST = intArrayOf(R.id.col0_dest, R.id.col1_dest)
        private val COL_VALUE = intArrayOf(R.id.col0_value, R.id.col1_value)
        private val COL_SUB = intArrayOf(R.id.col0_sub, R.id.col1_sub)

        // requestCode slot — (위젯, 칩)마다 유일해야 한다(WidgetCommon.rc 주석 참고).
        private const val SLOT_MODE_SHUTTLE = 3
        private const val SLOT_MODE_SUBWAY = 4
        private const val SLOT_OPEN = 5
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach {
            // 먼저 마지막 성공 응답으로 그린다 — 네트워크가 느리거나 죽어 있어도
            // 30분마다 위젯이 "불러오는 중"으로 깜빡이지 않는다.
            draw(context, manager, it, WidgetCommon.cached(context, it))
            load(context, manager, it)
        }
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        ids.forEach { WidgetCommon.forget(context, it, KEYS) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent) // APPWIDGET_UPDATE/DELETED 를 onUpdate/onDeleted 로 넘긴다
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
                WidgetCommon.dropCache(context, id) // 다른 모드/역의 값이 되살아나지 않게
                // 서버 왕복 전에 칩 상태만 먼저 반영한다. 누른 티가 안 나면 사용자는
                // 위젯이 죽은 줄 알고 다시 누른다. 본문은 응답이 와야 바뀐다.
                manager.partiallyUpdateAppWidget(id, chipsOnly(context, id))
                load(context, manager, id)
            }
            // 잠금 해제는 "지금 홈을 보는 순간"이라 가장 값진 갱신 시점이다. 다만 오레오
            // 이후 암시적 브로드캐스트 제한 탓에 기기에 따라 안 올 수 있어 보너스로만 본다.
            Intent.ACTION_USER_PRESENT ->
                WidgetCommon.idsOf(context, manager, javaClass).forEach { load(context, manager, it) }
        }
    }

    /** 같은 칩을 다시 눌러도 재조회가 돌아서 이게 사실상 수동 새로고침 경로다. */
    private fun load(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val app = context.applicationContext // onReceive 가 끝난 뒤에도 살아 있어야 한다
        val mode = WidgetCommon.get(app, "mode", widgetId, "shuttle")
        val campus = WidgetCommon.get(app, "campus", widgetId, "main")
        val station = WidgetCommon.get(app, "station", widgetId, "정왕")
        WidgetCommon.executor.execute {
            val query = "type=transit&mode=$mode&campus=$campus&station=${WidgetCommon.enc(station)}"
            val data = WidgetCommon.fetch(query) ?: return@execute // 실패하면 화면을 건드리지 않는다
            WidgetCommon.cache(app, widgetId, data)
            draw(app, manager, widgetId, data)
        }
    }

    private fun chipsOnly(context: Context, widgetId: Int): RemoteViews =
        RemoteViews(context.packageName, R.layout.widget_transit).also {
            applyChips(context, it, widgetId)
        }

    /**
     * 칩은 서버 응답이 아니라 저장된 선택값으로 그린다 — 응답이 오기 전에도, 응답이
     * 실패해도 칩은 사용자가 방금 고른 상태여야 한다. 클릭 인텐트도 여기서 함께
     * 다시 건다(모드가 바뀌면 세그 칩의 의미가 캠퍼스↔역으로 통째로 바뀌기 때문).
     */
    private fun applyChips(context: Context, views: RemoteViews, widgetId: Int) {
        val mode = WidgetCommon.get(context, "mode", widgetId, "shuttle")
        val kind = if (mode == "subway") "station" else "campus"
        val options = OPTIONS.getValue(kind)
        val current = WidgetCommon.get(context, kind, widgetId, options[0])

        for (i in SEG_IDS.indices) {
            val option = options.getOrNull(i)
            if (option == null) {
                // 캠퍼스는 2개뿐 — 세 번째 칩을 숨겨 역 3개짜리 세그와 레이아웃을 공유한다.
                views.setViewVisibility(SEG_IDS[i], View.GONE)
                continue
            }
            views.setViewVisibility(SEG_IDS[i], View.VISIBLE)
            views.setTextViewText(
                SEG_IDS[i],
                if (kind == "campus") (CAMPUS_LABEL[option] ?: option) else option
            )
            WidgetCommon.chip(context, views, SEG_IDS[i], option == current)
            views.setOnClickPendingIntent(
                SEG_IDS[i],
                WidgetCommon.select(
                    context, TransitWidgetProvider::class.java, ACTION_SELECT,
                    widgetId, kind, option, i
                )
            )
        }

        WidgetCommon.chip(context, views, R.id.transit_mode_shuttle, mode != "subway")
        WidgetCommon.chip(context, views, R.id.transit_mode_subway, mode == "subway")
        views.setOnClickPendingIntent(
            R.id.transit_mode_shuttle,
            WidgetCommon.select(
                context, TransitWidgetProvider::class.java, ACTION_SELECT,
                widgetId, "mode", "shuttle", SLOT_MODE_SHUTTLE
            )
        )
        views.setOnClickPendingIntent(
            R.id.transit_mode_subway,
            WidgetCommon.select(
                context, TransitWidgetProvider::class.java, ACTION_SELECT,
                widgetId, "mode", "subway", SLOT_MODE_SUBWAY
            )
        )
    }

    private fun draw(context: Context, manager: AppWidgetManager, widgetId: Int, data: JSONObject?) {
        val views = RemoteViews(context.packageName, R.layout.widget_transit)
        applyChips(context, views, widgetId)
        // 본문 탭은 앱으로. 칩은 자기 클릭을 먼저 먹으므로 루트에 걸어도 안 겹친다.
        views.setOnClickPendingIntent(
            R.id.widget_root, WidgetCommon.openApp(context, "/", widgetId, SLOT_OPEN)
        )

        if (data == null) {
            val mode = WidgetCommon.get(context, "mode", widgetId, "shuttle")
            views.setTextViewText(R.id.transit_title, if (mode == "subway") "지하철" else "셔틀")
            showEmpty(views, context.getString(R.string.widget_loading))
            manager.updateAppWidget(widgetId, views)
            return
        }

        views.setTextViewText(R.id.transit_title, WidgetCommon.str(data, "title"))

        val columns = data.optJSONArray("columns")
        val emptyText = WidgetCommon.str(data, "empty_text")
        if (emptyText.isNotEmpty() || columns == null || columns.length() == 0) {
            showEmpty(views, emptyText.ifEmpty { context.getString(R.string.widget_loading) })
            manager.updateAppWidget(widgetId, views)
            return
        }

        views.setViewVisibility(R.id.transit_columns, View.VISIBLE)
        views.setViewVisibility(R.id.transit_empty, View.GONE)
        val accent = WidgetCommon.color(context, R.color.tj_accent)
        val ink = WidgetCommon.color(context, R.color.tj_ink)
        for (i in COL_LABEL.indices) {
            val col = columns.optJSONObject(i)
            val value = WidgetCommon.str(col, "value")
            // empty 열은 값을 지우고 sub("오늘 운행 종료")만 남긴다 — 반대 방향은 살아 있으므로
            // 위젯 전체를 비우지 않는다(열 단위 저하).
            val hideValue = col == null || col.optBoolean("empty") || value.isEmpty()
            val dest = WidgetCommon.str(col, "dest")

            views.setTextViewText(COL_LABEL[i], WidgetCommon.str(col, "label"))
            views.setViewVisibility(COL_DEST[i], if (dest.isEmpty()) View.GONE else View.VISIBLE)
            views.setTextViewText(COL_DEST[i], dest)
            views.setViewVisibility(COL_VALUE[i], if (hideValue) View.GONE else View.VISIBLE)
            views.setTextViewText(COL_VALUE[i], value)
            views.setTextColor(COL_VALUE[i], if (WidgetCommon.isImminent(value)) accent else ink)
            views.setTextViewText(COL_SUB[i], WidgetCommon.str(col, "sub"))
        }
        manager.updateAppWidget(widgetId, views)
    }

    private fun showEmpty(views: RemoteViews, text: String) {
        views.setViewVisibility(R.id.transit_columns, View.GONE)
        views.setViewVisibility(R.id.transit_empty, View.VISIBLE)
        views.setTextViewText(R.id.transit_empty, text)
    }
}

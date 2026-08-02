package kr.ac.tukorea.taljungwang // TODO: 실제 패키지명으로 교체 (위젯 소스 4개 모두)

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * 위젯 3종(교통·학식·학사일정)이 공유하는 뼈대.
 *
 * 서버(`GET /api/v1/widget`)가 분 반올림·막차·끼니 선택·영업 판정을 전부 끝낸
 * 문자열을 내려주므로 여기서는 재가공하지 않는다. 클라이언트가 스스로 판단하는 건
 * "임박 색"([isImminent])과 D-day 알약 색 두 가지뿐이다 — 표기 규칙이 앱과 위젯에서
 * 갈라지면 어느 쪽이 맞는지 확인할 방법이 사용자에게 없다.
 */
object WidgetCommon {

    const val BASE = "https://www.taljungwang.kr"
    private const val ENDPOINT = "$BASE/api/v1/widget"
    private const val PREFS = "tal_widget"

    /**
     * 위젯 3종이 함께 쓰는 단일 워커.
     * 위젯 갱신은 많아야 초당 몇 건이라 스레드를 늘릴 이유가 없고, 직렬로 돌리면
     * 같은 위젯에 대한 응답이 뒤바뀌어 도착해 옛 값이 새 값을 덮는 일이 없다.
     */
    val executor: ExecutorService = Executors.newSingleThreadExecutor()

    /**
     * FLAG_IMMUTABLE 은 API 31+ 에서 필수다. 상수는 컴파일 시 인라인되고 옛 기기는
     * 모르는 플래그 비트를 무시하므로 버전 분기 없이 그대로 넘긴다.
     */
    val PI_FLAGS = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

    // ── 선택 상태 (위젯 인스턴스별) ────────────────────────────────────

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun get(context: Context, key: String, widgetId: Int, fallback: String): String =
        prefs(context).getString("${key}_$widgetId", fallback) ?: fallback

    fun put(context: Context, key: String, widgetId: Int, value: String) {
        prefs(context).edit().putString("${key}_$widgetId", value).apply()
    }

    /** onDeleted 용 — 위젯을 지웠는데 선택값이 남으면 새로 만든 위젯이 남의 설정을 물려받는다. */
    fun forget(context: Context, widgetId: Int, keys: List<String>) {
        val editor = prefs(context).edit()
        keys.forEach { editor.remove("${it}_$widgetId") }
        editor.remove("payload_$widgetId")
        editor.apply()
    }

    // ── 마지막 성공 응답 ──────────────────────────────────────────────
    //
    // 30분 주기 갱신·프로세스 재시작·비행기 모드 어디서든 위젯은 "직전에 보던 화면"을
    // 유지해야 한다. RemoteViews 는 매번 새로 만드는 객체라 앞선 내용을 물려받지
    // 못하므로(전체 갱신은 레이아웃 기본값으로 되돌아간다) 응답 원문을 저장해 둔다.

    fun cached(context: Context, widgetId: Int): JSONObject? = try {
        prefs(context).getString("payload_$widgetId", null)?.let { JSONObject(it) }
    } catch (_: Exception) {
        null
    }

    fun cache(context: Context, widgetId: Int, data: JSONObject) {
        prefs(context).edit().putString("payload_$widgetId", data.toString()).apply()
    }

    /**
     * 선택이 바뀌면 캐시를 버린다. 안 버리면 "지하철"을 고른 뒤 응답을 못 받은 채
     * 프로세스가 재시작됐을 때 지하철 칩 아래에 셔틀 시각이 되살아난다.
     * (화면에 이미 그려진 픽셀은 건드리지 않는다 — 응답이 올 때까지는 옛 화면이 낫다.)
     */
    fun dropCache(context: Context, widgetId: Int) {
        prefs(context).edit().remove("payload_$widgetId").apply()
    }

    // ── 네트워크 ─────────────────────────────────────────────────────

    /**
     * 실패는 전부 null 로 접는다. 호출부는 null 이면 아무것도 그리지 않는다 —
     * 위젯은 크래시해도 사용자가 원인을 볼 수 없으니 "빈 화면"보다 "옛 화면"이 낫다.
     */
    fun fetch(query: String): JSONObject? = try {
        val conn = (URL("$ENDPOINT?$query").openConnection() as HttpURLConnection).apply {
            connectTimeout = 5000
            readTimeout = 5000
            setRequestProperty("Accept", "application/json")
        }
        try {
            conn.inputStream.bufferedReader().use { it.readText() }
                .let { JSONObject(it) }
                .takeIf { it.optBoolean("success") }
                ?.optJSONObject("data")
        } finally {
            conn.disconnect()
        }
    } catch (_: Exception) {
        null
    }

    /** 역 이름이 한글이라 인코딩 없이는 쿼리가 깨진다(정왕/초지/시흥시청). */
    fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    /**
     * org.json 의 optString 은 JSON `null` 을 만나면 fallback 이 아니라 "null" 문자열을
     * 돌려준다. empty_text 가 실제로 null 로 내려오는 필드라 반드시 isNull 을 먼저 본다.
     */
    fun str(json: JSONObject?, key: String): String =
        if (json == null || json.isNull(key)) "" else json.optString(key, "")

    // ── 표시 판단 ─────────────────────────────────────────────────────

    /** "곧" 이거나 "N분"에서 N ≤ 5 — 앱의 임박 기준(≤5분)과 같은 값이다. */
    fun isImminent(value: String): Boolean {
        if (value.startsWith("곧")) return true
        val n = value.takeWhile { it.isDigit() }.toIntOrNull() ?: return false
        return value.endsWith("분") && n <= 5
    }

    fun color(context: Context, res: Int): Int = ContextCompat.getColor(context, res)

    /** 칩 선택 상태 — 배경 리소스와 글자색을 함께 바꾼다(둘 중 하나만 바꾸면 안 읽힌다). */
    fun chip(context: Context, views: RemoteViews, viewId: Int, selected: Boolean) {
        views.setInt(
            viewId, "setBackgroundResource",
            if (selected) R.drawable.widget_chip_on else R.drawable.widget_chip_off
        )
        views.setTextColor(
            viewId,
            color(context, if (selected) R.color.tj_chip_on_ink else R.color.tj_mute)
        )
    }

    // ── PendingIntent ────────────────────────────────────────────────

    /**
     * (위젯, 칩) 마다 유일한 requestCode.
     *
     * PendingIntent 동등성 판정은 extra 를 보지 않는다. 같은 액션·같은 컴포넌트에
     * key/value 만 다른 인텐트를 requestCode 없이 만들면 나중 것이 앞의 것을 덮어써
     * 엉뚱한 칩이 눌린 것처럼 동작한다(FLAG_UPDATE_CURRENT 가 그 덮어쓰기를 한다).
     * slot 은 위젯당 0..15 로 충분하고, appWidgetId 는 순차 증가라 곱해도 안전하다.
     */
    fun rc(widgetId: Int, slot: Int): Int = widgetId * 16 + slot

    /**
     * 본문 탭 → 앱 딥링크.
     * setPackage 로 우리 앱을 못 박는다 — 안 그러면 브라우저 선택 다이얼로그가 뜨거나
     * TWA 가 아니라 크롬이 열린다(TWA LauncherActivity 에 이 호스트의 VIEW 필터가 있다).
     */
    fun openApp(context: Context, path: String, widgetId: Int, slot: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(BASE + path))
            .setPackage(context.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(context, rc(widgetId, slot), intent, PI_FLAGS)
    }

    /** 칩 탭 → 각 provider 자신에게 보내는 브로드캐스트(앱을 열지 않는다). */
    fun select(
        context: Context,
        provider: Class<*>,
        action: String,
        widgetId: Int,
        key: String,
        value: String,
        slot: Int,
    ): PendingIntent {
        val intent = Intent(context, provider)
            .setAction(action)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            .putExtra("key", key)
            .putExtra("value", value)
        return PendingIntent.getBroadcast(context, rc(widgetId, slot), intent, PI_FLAGS)
    }

    /** 브로드캐스트 하나로 온 위젯 id — 없으면 이 provider 의 전체 id. */
    fun idsOf(context: Context, manager: AppWidgetManager, provider: Class<*>): IntArray =
        manager.getAppWidgetIds(android.content.ComponentName(context, provider))
}

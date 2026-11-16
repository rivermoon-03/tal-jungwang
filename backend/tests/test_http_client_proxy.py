import httpx

from app.core.http_client import _proxy_mounts


def test_no_proxy_when_unset():
    assert _proxy_mounts("") is None


def test_only_data_go_kr_goes_through_proxy():
    mounts = _proxy_mounts("http://127.0.0.1:3128")
    assert list(mounts) == ["https://apis.data.go.kr"]
    assert isinstance(mounts["https://apis.data.go.kr"], httpx.AsyncHTTPTransport)

    client = httpx.AsyncClient(mounts=mounts)
    gbis = client._transport_for_url(httpx.URL("https://apis.data.go.kr/6410000/x"))
    other = client._transport_for_url(httpx.URL("https://api.odcloud.kr/x"))
    assert gbis is mounts["https://apis.data.go.kr"]
    assert other is not gbis

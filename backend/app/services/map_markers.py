from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bus import BusStop


async def get_markers(db: AsyncSession) -> dict:
    stmt = select(BusStop).order_by(BusStop.id)
    result = await db.execute(stmt)
    stops = result.scalars().all()

    markers = []

    for s in stops:
        # Determine marker type based on name
        if "정왕역" in s.name:
            m_type = "subway_station"
            m_id = f"subway-{s.id}"
        elif "셔틀" in s.name:
            m_type = "shuttle_stop"
            m_id = f"shuttle-{s.id}"
        else:
            m_type = "bus_station"
            m_id = f"station-{s.id}"

        markers.append({
            "id": m_id,
            "type": m_type,
            "name": s.name,
            "lat": float(s.lat),
            "lng": float(s.lng),
            "extra": {"gbis_station_id": s.gbis_station_id} if s.gbis_station_id else None,
        })

    return {"markers": markers}

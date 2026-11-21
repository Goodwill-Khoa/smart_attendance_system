from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine import make_url
from dotenv import load_dotenv
import os
from pathlib import Path
from threading import RLock

load_dotenv()

CONFIGURED_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./attendance.db")
_configured_url = make_url(CONFIGURED_DATABASE_URL)
_configured_database_path = (
    Path(_configured_url.database).expanduser().resolve()
    if _configured_url.drivername == "sqlite"
    and _configured_url.database
    and _configured_url.database != ":memory:"
    else None
)
SEMESTER_DATABASE_DIR = Path(
    os.getenv(
        "SEMESTER_DATABASE_DIR",
        str((_configured_database_path.parent if _configured_database_path else Path.cwd()) / "semester_databases"),
    )
).expanduser().resolve()
SEMESTER_DATABASE_REGISTRY_PATH = Path(
    os.getenv("SEMESTER_DATABASE_REGISTRY_PATH", str(SEMESTER_DATABASE_DIR / "registry.json"))
).expanduser().resolve()
_database_switch_lock = RLock()


def _url_for_sqlite_path(path: Path) -> str:
    return _configured_url.set(database=path.resolve().as_posix()).render_as_string(hide_password=False)


def _startup_database_url() -> str:
    if _configured_database_path is None or not SEMESTER_DATABASE_REGISTRY_PATH.exists():
        return CONFIGURED_DATABASE_URL

    import json

    try:
        registry = json.loads(SEMESTER_DATABASE_REGISTRY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("The semester database registry could not be read.") from error

    active_path_value = registry.get("active_database")
    if not isinstance(active_path_value, str) or not active_path_value.strip():
        raise RuntimeError("The semester database registry has no active database path.")

    active_path = Path(active_path_value).expanduser().resolve()
    if not active_path.is_file():
        raise RuntimeError(f"The active semester database does not exist: {active_path}")
    return _url_for_sqlite_path(active_path)


DATABASE_URL = _startup_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def semester_database_supported() -> bool:
    return _configured_database_path is not None


def active_database_path() -> Path | None:
    if engine.url.drivername != "sqlite" or not engine.url.database or engine.url.database == ":memory:":
        return None
    return Path(engine.url.database).expanduser().resolve()


def switch_to_sqlite_database(path: Path) -> None:
    global DATABASE_URL, SessionLocal, engine

    if not semester_database_supported():
        raise RuntimeError("Semester database switching is supported only with a file-based SQLite DATABASE_URL.")

    database_url = _url_for_sqlite_path(path)
    with _database_switch_lock:
        old_engine = engine
        new_engine = create_engine(database_url, pool_pre_ping=True)
        engine = new_engine
        SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=new_engine,
        )
        DATABASE_URL = database_url
    old_engine.dispose()


def get_db():
    with _database_switch_lock:
        session_factory = SessionLocal
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
import json
import tempfile
import unittest
import uuid
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

import database
import models
import semester_databases


class SemesterDatabaseLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory(prefix="semester-database-test-")
        self.root = Path(self.temporary_directory.name)
        self.source_path = self.root / "attendance.sqlite3"
        self.database_directory = self.root / "semester_databases"
        self.registry_path = self.database_directory / "registry.json"
        self.source_engine = create_engine(
            f"sqlite:///{self.source_path.as_posix()}",
            poolclass=NullPool,
        )
        models.Base.metadata.create_all(bind=self.source_engine)

        self.user_id = uuid.uuid4()
        self.course_id = uuid.uuid4()
        session_id = uuid.uuid4()
        with Session(self.source_engine) as source:
            source.add_all([
                models.User(
                    id=self.user_id,
                    email="student@example.test",
                    name="Test Student",
                    role=models.UserRole.STUDENT,
                    is_admin=False,
                ),
                models.Course(
                    id=self.course_id,
                    name="Algorithms",
                    course_type="L",
                    code="ALG-L",
                    semester="Autumn 2026",
                ),
                models.Session(id=session_id, course_id=self.course_id, active=False),
                models.AttendanceLog(
                    session_id=session_id,
                    user_id=self.user_id,
                    device_id="qr:test",
                    qr_timestamp=datetime.utcnow(),
                    status="PRESENT",
                ),
                models.TeacherCourseAssignment(
                    id=uuid.uuid4(),
                    teacher_email="teacher@example.test",
                    course_id=self.course_id,
                ),
                models.CourseStudentRegistry(
                    id=uuid.uuid4(),
                    course_id=self.course_id,
                    student_email="student@example.test",
                    student_name="Test Student",
                ),
            ])
            source.commit()

        self.database_patches = [
            patch.object(database, "_configured_url", make_url(f"sqlite:///{self.source_path.as_posix()}")),
            patch.object(database, "_configured_database_path", self.source_path),
            patch.object(database, "SEMESTER_DATABASE_DIR", self.database_directory),
            patch.object(database, "SEMESTER_DATABASE_REGISTRY_PATH", self.registry_path),
            patch.object(database, "engine", self.source_engine),
            patch.object(
                database,
                "SessionLocal",
                sessionmaker(autocommit=False, autoflush=False, bind=self.source_engine),
            ),
        ]
        for database_patch in self.database_patches:
            database_patch.start()

    def tearDown(self):
        database.engine.dispose()
        self.source_engine.dispose()
        for database_patch in reversed(self.database_patches):
            database_patch.stop()
        self.temporary_directory.cleanup()

    def test_activation_preserves_archive_and_copies_only_reference_data(self):
        with Session(self.source_engine) as source:
            result = semester_databases.create_and_activate(source, "Spring 2027", [self.course_id])

        active_path = database.active_database_path()
        self.assertEqual(result["active_semester"], "Spring 2027")
        self.assertEqual(active_path, (self.database_directory / "spring-2027.sqlite3").resolve())
        registry = json.loads(self.registry_path.read_text(encoding="utf-8"))
        self.assertEqual(registry["active_semester"], "Spring 2027")
        self.assertEqual(Path(make_url(database._startup_database_url()).database).resolve(), active_path)

        with Session(database.engine) as active:
            course = active.query(models.Course).one()
            self.assertEqual(course.semester, "Spring 2027")
            self.assertEqual(active.query(models.User).count(), 1)
            self.assertEqual(active.query(models.TeacherCourseAssignment).count(), 1)
            self.assertEqual(active.query(models.CourseStudentRegistry).count(), 1)
            self.assertEqual(active.query(models.AttendanceLog).count(), 0)
            self.assertEqual(active.query(models.Session).count(), 0)

        archive_engine = create_engine(
            f"sqlite:///{self.source_path.as_posix()}",
            poolclass=NullPool,
        )
        try:
            with Session(archive_engine) as archive:
                self.assertEqual(archive.query(models.Course).one().semester, "Autumn 2026")
                self.assertEqual(archive.query(models.AttendanceLog).count(), 1)
        finally:
            archive_engine.dispose()

    def test_activation_rejects_duplicate_course_ids(self):
        with Session(self.source_engine) as source:
            with self.assertRaisesRegex(ValueError, "selected more than once"):
                semester_databases.create_and_activate(
                    source,
                    "Spring 2027",
                    [self.course_id, self.course_id],
                )

    def test_activation_rejects_active_sessions(self):
        with Session(self.source_engine) as source:
            source.add(models.Session(id=uuid.uuid4(), course_id=self.course_id, active=True))
            source.commit()
            with self.assertRaisesRegex(ValueError, "active class sessions"):
                semester_databases.create_and_activate(source, "Spring 2027", [self.course_id])

    def test_activation_requires_file_based_sqlite(self):
        with patch.object(database, "_configured_database_path", None):
            with Session(self.source_engine) as source:
                with self.assertRaisesRegex(ValueError, "local file-based SQLite"):
                    semester_databases.create_and_activate(source, "Spring 2027", [self.course_id])


if __name__ == "__main__":
    unittest.main()

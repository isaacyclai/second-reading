-- Materialized View for Member List
-- This pre-computes the expensive member data for fast list queries
-- Run REFRESH MATERIALIZED VIEW member_list_view; after ingesting new data

DROP MATERIALIZED VIEW IF EXISTS member_list_view;

CREATE MATERIALIZED VIEW member_list_view AS
WITH LatestSpeakerInfo AS (
  SELECT DISTINCT ON (ss.member_id)
    ss.member_id,
    ss.constituency as speaker_constituency,
    ss.designation as speaker_designation
  FROM section_speakers ss
  JOIN sections s ON ss.section_id = s.id
  JOIN sessions sess ON s.session_id = sess.id
  WHERE ss.constituency IS NOT NULL OR ss.designation IS NOT NULL
  ORDER BY ss.member_id, sess.date DESC
),
LatestAttendanceInfo AS (
  SELECT DISTINCT ON (sa.member_id)
    sa.member_id,
    sa.constituency as attendance_constituency,
    sa.designation as attendance_designation
  FROM session_attendance sa
  JOIN sessions sess ON sa.session_id = sess.id
  WHERE sa.constituency IS NOT NULL OR sa.designation IS NOT NULL
  ORDER BY sa.member_id, sess.date DESC
),
MemberSectionCounts AS (
  SELECT member_id, COUNT(DISTINCT section_id) as section_count
  FROM section_speakers
  GROUP BY member_id
)
SELECT
  m.id,
  m.name,
  ms.summary,
  COALESCE(msc.section_count, 0) as section_count,
  COALESCE(lsi.speaker_constituency, lai.attendance_constituency) as constituency,
  COALESCE(lsi.speaker_designation, lai.attendance_designation) as designation
FROM members m
LEFT JOIN member_summaries ms ON m.id = ms.member_id
LEFT JOIN LatestSpeakerInfo lsi ON m.id = lsi.member_id
LEFT JOIN LatestAttendanceInfo lai ON m.id = lai.member_id
LEFT JOIN MemberSectionCounts msc ON m.id = msc.member_id;

-- Create indexes on the materialized view for fast filtering/sorting
CREATE INDEX idx_member_list_name ON member_list_view(name);
CREATE INDEX idx_member_list_constituency ON member_list_view(constituency);
CREATE INDEX idx_member_list_section_count ON member_list_view(section_count DESC);

-- Allow concurrent refresh (requires unique index)
CREATE UNIQUE INDEX idx_member_list_id ON member_list_view(id);

-- =====================================================================
-- CollegeRandom — starter data. Run AFTER schema.sql.
-- =====================================================================

-- 1) YOUR ADMIN ACCOUNT
--    Replace the email below with the email you will sign up with.
--    This lets you register even without a college email and makes you an
--    admin automatically. Run it BEFORE you create your account.
insert into public.admin_emails (email) values (lower('you@example.com'))
on conflict do nothing;

-- 2) STARTER UNIVERSITIES + APPROVED EMAIL DOMAINS
--    Double-check each domain against the school's IT pages before launch.
--    Remove any school you don't want, and add your own campus first —
--    that's where your first 50 testers will come from.
--
--    Important: a school email does NOT prove someone is a current student
--    (staff and alumni often keep addresses). Where a school issues a
--    student-only subdomain, prefer it and set allow_subdomains = false.
with u as (
  insert into public.universities (name, short_name, state) values
    ('Massachusetts Institute of Technology', 'MIT', 'MA'),
    ('Stanford University', 'Stanford', 'CA'),
    ('University of California, Berkeley', 'UC Berkeley', 'CA'),
    ('University of California, Los Angeles', 'UCLA', 'CA'),
    ('University of Michigan', 'Michigan', 'MI'),
    ('The University of Texas at Austin', 'UT Austin', 'TX'),
    ('New York University', 'NYU', 'NY'),
    ('Columbia University', 'Columbia', 'NY'),
    ('University of Pennsylvania', 'Penn', 'PA'),
    ('Cornell University', 'Cornell', 'NY'),
    ('Georgia Institute of Technology', 'Georgia Tech', 'GA'),
    ('University of Washington', 'UW', 'WA'),
    ('University of Illinois Urbana-Champaign', 'UIUC', 'IL'),
    ('Arizona State University', 'ASU', 'AZ'),
    ('University of Florida', 'UF', 'FL'),
    ('The Ohio State University', 'Ohio State', 'OH'),
    ('Penn State University', 'Penn State', 'PA'),
    ('Rutgers University', 'Rutgers', 'NJ'),
    ('Boston University', 'BU', 'MA'),
    ('University of Southern California', 'USC', 'CA'),
    ('University of Wisconsin–Madison', 'UW–Madison', 'WI'),
    ('Purdue University', 'Purdue', 'IN'),
    ('University of North Carolina at Chapel Hill', 'UNC', 'NC'),
    ('University of Maryland, College Park', 'UMD', 'MD'),
    ('University of North Georgia', 'UNG', 'GA')
  on conflict (name) do update set short_name = excluded.short_name
  returning id, short_name
)
insert into public.approved_domains (domain, university_id, allow_subdomains)
select d.domain, u.id, true
from u
join (values
  ('MIT', 'mit.edu'),
  ('Stanford', 'stanford.edu'),
  ('UC Berkeley', 'berkeley.edu'),
  ('UCLA', 'ucla.edu'),
  ('Michigan', 'umich.edu'),
  ('UT Austin', 'utexas.edu'),
  ('NYU', 'nyu.edu'),
  ('Columbia', 'columbia.edu'),
  ('Penn', 'upenn.edu'),
  ('Cornell', 'cornell.edu'),
  ('Georgia Tech', 'gatech.edu'),
  ('UW', 'uw.edu'),
  ('UIUC', 'illinois.edu'),
  ('ASU', 'asu.edu'),
  ('UF', 'ufl.edu'),
  ('Ohio State', 'osu.edu'),
  ('Penn State', 'psu.edu'),
  ('Rutgers', 'rutgers.edu'),
  ('BU', 'bu.edu'),
  ('USC', 'usc.edu'),
  ('UW–Madison', 'wisc.edu'),
  ('Purdue', 'purdue.edu'),
  ('UNC', 'unc.edu'),
  ('UMD', 'umd.edu'),
  ('UNG', 'ung.edu')
) as d(short_name, domain) on d.short_name = u.short_name
on conflict (domain) do nothing;

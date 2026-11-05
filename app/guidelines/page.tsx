import { PageShell } from '@/components/PageShell';

export const metadata = { title: 'Community Guidelines' };

export default function GuidelinesPage() {
  return (
    <PageShell
      title="Community Guidelines"
      subtitle="CollegeRandom only works if everyone feels safe. Breaking these rules gets you suspended or banned."
    >
      <h2>Who can use CollegeRandom</h2>
      <ul>
        <li>You must be 18 or older.</li>
        <li>You must be a current student using your own school-issued email address.</li>
        <li>One account per person. Don’t share or sell accounts.</li>
      </ul>

      <h2>Zero tolerance — instant ban</h2>
      <ul>
        <li>Nudity, sexual acts, or sexual content of any kind.</li>
        <li>Anything involving minors, or anyone who appears to be under 18 on camera.</li>
        <li>Threats, violence, self-harm content, or encouraging others to hurt themselves.</li>
        <li>Hate speech, slurs, or attacks based on race, ethnicity, religion, gender, sexual orientation, disability or nationality.</li>
        <li>Recording, screenshotting or streaming someone without their clear permission, or posting it elsewhere.</li>
      </ul>

      <h2>Not allowed</h2>
      <ul>
        <li>Harassment, bullying, or continuing after someone asks you to stop.</li>
        <li>Spam, scams, advertising, or asking for money, payment apps or crypto.</li>
        <li>Impersonating someone else or lying about your school.</li>
        <li>Pressuring people for personal info (address, dorm, phone, socials).</li>
        <li>Illegal activity, drugs sales, or weapons.</li>
      </ul>

      <h2>Protect yourself</h2>
      <ul>
        <li>CollegeRandom does <strong>not</strong> record video chats. But the other person could record their screen without telling you, so privacy can’t be guaranteed. Don’t show or say anything you wouldn’t want saved.</li>
        <li>Don’t share your full name, address, dorm, class schedule or financial info.</li>
        <li>Tap <strong>Next</strong> any time you feel uncomfortable. You never owe anyone a conversation.</li>
        <li>Use <strong>Report</strong> for rule-breaking and <strong>Block</strong> so you’ll never be matched with that person again.</li>
      </ul>

      <h2>How enforcement works</h2>
      <p>
        Reports go to our moderation team with the chat’s match ID (not a recording). If several different students
        report the same account within 24 hours, that account is automatically suspended until we review it.
        Serious violations result in a permanent ban. If you believe someone is in immediate danger, call 911.
      </p>
    </PageShell>
  );
}

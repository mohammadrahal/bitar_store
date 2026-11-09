import { UserProfilePageView } from '@/components/users/user-profile-page-view'

export const metadata = { title: 'Employee profile' }

type Props = { params: Promise<{ id: string }> }

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params
  return <UserProfilePageView userId={id} />
}

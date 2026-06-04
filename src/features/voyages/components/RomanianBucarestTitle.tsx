const ROMANIAN_BLUE = '#2F5198'
const ROMANIAN_YELLOW = '#E7C85A'
const ROMANIAN_RED = '#C84B58'

interface RomanianBucarestTitleProps {
  name: string
}

export function RomanianBucarestTitle({ name }: RomanianBucarestTitleProps) {
  if (name.trim().toLowerCase() !== 'bucarest') {
    return <>{name}</>
  }

  return (
    <>
      <span style={{ color: ROMANIAN_BLUE }}>Bu</span>
      <span style={{ color: ROMANIAN_YELLOW }}>car</span>
      <span style={{ color: ROMANIAN_RED }}>est</span>
    </>
  )
}

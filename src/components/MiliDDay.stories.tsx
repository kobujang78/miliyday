import React from 'react'
import MiliDDay from './MiliDDay'

export default {
  title: 'Components/MiliDDay',
  component: MiliDDay,
}

export const Default = () => <MiliDDay enlistmentDate={'2024-08-15'} branch={'army'} />
export const Navy = () => <MiliDDay enlistmentDate={'2024-01-10'} branch={'navy'} />
export const Empty = () => <MiliDDay enlistmentDate={undefined} branch={'airforce'} />

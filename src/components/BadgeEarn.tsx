"use client"
import React, { useEffect, useState } from 'react'

export default function BadgeEarn({ percent }:{ percent:number }){
  const [earned, setEarned] = useState<number[]>([])
  useEffect(()=>{
    const milestones = [25,50,75]
    milestones.forEach(m=>{
      if(percent>=m && !earned.includes(m)){
        setTimeout(()=>{
          alert(`축하합니다! ${m}% 달성 배지 획득`)
          setEarned(prev=>[...prev,m])
        },200)
      }
    })
  },[percent])

  return null
}

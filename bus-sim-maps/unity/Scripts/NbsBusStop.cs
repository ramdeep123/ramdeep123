// Trigger volume at a NammaBusSim bus stop (created by NbsMapLoader).
// Your bus needs a Rigidbody (or CharacterController) + collider and either the tag "Bus" or an
// NbsBusTag component so the stop can recognise it.

using UnityEngine;
using UnityEngine.Events;

namespace NammaBusSim.Maps
{
    [System.Serializable] public class NbsStopEvent : UnityEvent<NbsBusStop, GameObject> { }

    public class NbsBusStop : MonoBehaviour
    {
        public int index;
        public string nameLocal;
        public string nameEn;
        public string doorSide;            // "left" or "right" - which side the passengers board
        public float routeDistance;

        public NbsStopEvent onBusEnter = new NbsStopEvent();
        public NbsStopEvent onBusExit = new NbsStopEvent();

        public bool BusInside { get; private set; }

        static bool IsBus(Collider c) =>
            c.attachedRigidbody != null && (c.attachedRigidbody.CompareTag("Bus") || c.attachedRigidbody.GetComponent<NbsBusTag>() != null)
            || c.CompareTag("Bus") || c.GetComponentInParent<NbsBusTag>() != null;

        void OnTriggerEnter(Collider other)
        {
            if (!IsBus(other)) return;
            BusInside = true;
            onBusEnter.Invoke(this, other.attachedRigidbody ? other.attachedRigidbody.gameObject : other.gameObject);
        }

        void OnTriggerExit(Collider other)
        {
            if (!IsBus(other)) return;
            BusInside = false;
            onBusExit.Invoke(this, other.attachedRigidbody ? other.attachedRigidbody.gameObject : other.gameObject);
        }

        public override string ToString() => string.IsNullOrEmpty(nameLocal) || nameLocal == nameEn ? nameEn : $"{nameLocal} / {nameEn}";
    }

}
